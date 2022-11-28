import { Dispatch } from '../dispatch/Dispatch';
import { Config } from '../orchestration/Orchestration';
import { EventCache } from '../event-cache/EventCache';
import { NIL_UUID } from '../sessions/SessionManager';
import {
    BatchEvaluateFeatureRequest,
    BatchEvaluateFeatureResult,
    ContextType,
    ClientEvaluationResult,
    ClientEvaluationResults,
    EvidentlyRequest
} from './types';
import { Response } from 'node-fetch';

const MAX_EVIDENTLY_FEATURES_PER_EVENT = 10;

const REQUEST_CACHE_KEY = 'lastRequest';
const EVALS_CACHE_KEY = 'cachedEvaluations';

export class EvidentlyManager {
    private eventCache: EventCache;
    private dispatchManager: Dispatch;
    private config: Config;
    private isEnabled: boolean;

    private lastRequest?: EvidentlyRequest;
    private cachedEvaluations: ClientEvaluationResults = {};
    private lastPromise: Promise<ClientEvaluationResults> = Promise.resolve({});
    private cacheValidCheck = 0;

    constructor(
        config: Config,
        eventCache: EventCache,
        dispatchManager: Dispatch
    ) {
        this.eventCache = eventCache;
        this.dispatchManager = dispatchManager;
        this.config = config;
        this.isEnabled = config.evidentlyConfig.project !== undefined;
    }

    public loadEvaluations(request: EvidentlyRequest) {
        if (!this.isEnabled) {
            throw new Error('Evidently is not enabled');
        } else if (request.features.length > MAX_EVIDENTLY_FEATURES_PER_EVENT) {
            throw new Error(
                `Can only request up to ${MAX_EVIDENTLY_FEATURES_PER_EVENT} features at a time`
            );
        }

        let neededFeatureIds: string[] = request.features;
        // Check Cache
        const lastRequest: EvidentlyRequest | undefined = this.getLastRequest();
        if (
            lastRequest &&
            lastRequest.entityId === request.entityId &&
            this.contextMatches(lastRequest.context, request.context)
        ) {
            // Can reuse cached evaluations
            const allCachedEvaluations = this.getCachedEvaluations();

            // Remove features that have a cached evaluation
            neededFeatureIds = neededFeatureIds.filter(
                (id) => !allCachedEvaluations[id]
            );
        } else {
            // Request has changed or no longer exists, cached evaluations are now invalid
            this.clearCachedEvaluations();
            this.cacheValidCheck++;
        }

        this.updateLastRequest(request);
        const apiRequest = {
            ...request,
            features: neededFeatureIds
        };

        const apiEvaluationsPromise =
            neededFeatureIds.length > 0
                ? this.fetchAPIEvaluations(apiRequest)
                : Promise.resolve({});

        const savedCacheValidCheck = this.cacheValidCheck;
        this.lastPromise = apiEvaluationsPromise.then((evals) => {
            // Only add evaluations to cache if they are still valid for the last loadFeatures request
            if (savedCacheValidCheck === this.cacheValidCheck) {
                this.addToCachedEvaluations(evals);
            }
            return evals;
        });
        this.eventCache.resetEvidentlyAttributes();
    }

    public async getEvaluations(
        features: string[]
    ): Promise<ClientEvaluationResults> {
        if (!this.isEnabled) {
            throw new Error('Evidently is not enabled');
        }

        const lastRequest: EvidentlyRequest | undefined = this.getLastRequest();
        if (!lastRequest) {
            throw new Error(
                `Evaluations for features [${features.join(', ')}] not loaded`
            );
        }

        const featureSet = new Set(lastRequest.features);
        const notLoadedFeatures = features.filter((f) => !featureSet.has(f));
        if (notLoadedFeatures.length > 0) {
            throw new Error(
                `Evaluations for features [${notLoadedFeatures.join(
                    ', '
                )}] not loaded`
            );
        }

        const allCachedEvaluations = this.getCachedEvaluations();
        // Get all evaluations in the request that have already been cached
        const requestedEvaluations = Object.fromEntries(
            features
                .map((feature) => {
                    const evaluation = allCachedEvaluations[feature];
                    if (evaluation) {
                        return [feature, evaluation];
                    } else {
                        return undefined;
                    }
                })
                .filter((entry) => entry) as [string, ClientEvaluationResult][]
        );
        if (features.length === Object.keys(requestedEvaluations).length) {
            // We have all evaluations that are being requested, return them
            this.addEvaluationToEvents(requestedEvaluations);
            return requestedEvaluations;
        }

        // If we are currently fetching some of the requested evaluations, return a promise with results
        const apiEvaluations: ClientEvaluationResults = await this.getLastPromise();

        const responseEvaluations = Object.fromEntries(
            features.map((feature) => {
                const evaluation =
                    apiEvaluations[feature] || allCachedEvaluations[feature];
                if (evaluation) {
                    return [feature, evaluation];
                } else {
                    throw new Error(
                        `Evaluation for feature [${feature}] not loaded`
                    );
                }
            })
        );
        this.addEvaluationToEvents(responseEvaluations);
        return responseEvaluations;
    }

    private getLastPromise(): Promise<ClientEvaluationResults> {
        return this.lastPromise;
    }

    private getCachedEvaluations(): ClientEvaluationResults {
        if (
            this.useSessionStorage() &&
            Object.keys(this.cachedEvaluations).length === 0
        ) {
            try {
                const jsonEvals = sessionStorage.getItem(EVALS_CACHE_KEY);
                const sessionStorageEvals = JSON.parse(
                    jsonEvals as string
                ) as ClientEvaluationResults;
                if (sessionStorageEvals) {
                    this.cachedEvaluations = sessionStorageEvals;
                }
            } catch (e) {
                // Ignore
            }
        }
        return this.cachedEvaluations;
    }

    private addToCachedEvaluations(evaluations: ClientEvaluationResults) {
        Object.entries(evaluations).forEach(([featureId, evaluation]) => {
            // Only add new evaluations to the cache
            if (!this.cachedEvaluations.hasOwnProperty(featureId)) {
                this.cachedEvaluations[featureId] = evaluation;
            }
        });
        if (this.useSessionStorage()) {
            sessionStorage.setItem(
                EVALS_CACHE_KEY,
                JSON.stringify(this.cachedEvaluations)
            );
        }
    }

    private clearCachedEvaluations() {
        this.cachedEvaluations = {};
        if (this.useSessionStorage()) {
            sessionStorage.clear();
        }
    }

    private getLastRequest(): EvidentlyRequest | undefined {
        if (this.lastRequest) {
            return this.lastRequest;
        } else if (this.useSessionStorage()) {
            try {
                const jsonRequest = sessionStorage.getItem(REQUEST_CACHE_KEY);
                return JSON.parse(jsonRequest as string) as EvidentlyRequest;
            } catch (e) {
                // Ignore
            }
        }
        return undefined;
    }

    private updateLastRequest(request: EvidentlyRequest) {
        this.lastRequest = request;
        if (this.useSessionStorage()) {
            sessionStorage.setItem(REQUEST_CACHE_KEY, JSON.stringify(request));
        }
    }

    private contextMatches(c1?: ContextType, c2?: ContextType): boolean {
        // Note: Will return false if context has the same values but in a different order,
        //  we ignore this edge case to avoid complex equality checking
        return JSON.stringify(c1 || {}) === JSON.stringify(c2 || {});
    }

    private addEvaluationToEvents(evals: ClientEvaluationResults) {
        const evidentlySessionAttributes: {
            [key: string]: string;
        } = Object.fromEntries(
            Object.values(evals).map((evaluation) => {
                return [evaluation.feature, evaluation.variation];
            })
        );
        this.eventCache.addEvidentlyAttributes(evidentlySessionAttributes);
    }

    private getDefaultEntityId(): string {
        const userDetails = this.eventCache.getUserDetails();
        return (userDetails.userId === NIL_UUID
            ? userDetails.sessionId
            : userDetails.userId) as string;
    }

    private async fetchAPIEvaluations(
        request: EvidentlyRequest
    ): Promise<ClientEvaluationResults> {
        const entityId = request.entityId || this.getDefaultEntityId();
        const context = request.context
            ? JSON.stringify(request.context)
            : undefined;
        const apiRequest: BatchEvaluateFeatureRequest = {
            requests: request.features.map((feature) => ({
                entityId,
                evaluationContext: context,
                feature
            }))
        };

        const httpResponse = await this.dispatchManager.dispatchBatchEvaluateFeature(
            apiRequest
        );

        const evaluations: BatchEvaluateFeatureResult = await new Response(
            httpResponse?.response.body
        ).json();

        return evaluations.results.reduce(
            (acc: ClientEvaluationResults, cur) => {
                const evaluation: ClientEvaluationResult = {
                    // Features can be returned as ARNs, only keep the feature name
                    feature: cur.feature.substring(
                        cur.feature.lastIndexOf('/') + 1
                    ),
                    reason: cur.reason,
                    value: cur.value,
                    variation: cur.variation
                };
                return { ...acc, [evaluation.feature]: evaluation };
            },
            {}
        );
    }

    private useSessionStorage() {
        return navigator.cookieEnabled && this.config.allowCookies;
    }
}
