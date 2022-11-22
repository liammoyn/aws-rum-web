import { Dispatch } from '../dispatch/Dispatch';
import { Config } from '../orchestration/Orchestration';
import { EventCache } from '../event-cache/EventCache';
import { NIL_UUID } from '../sessions/SessionManager';
import {
    BatchEvaluateFeatureRequest,
    BatchEvaluateFeatureResult,
    ContextType,
    EvaluationResult,
    EvaluationResults,
    EvidentlyRequest
} from './types';

// TODO: Replace this with the real value
export const MAX_EVIDENTLY_FEATURES_PER_EVENT = 15;

const REQUEST_CACHE_KEY = 'lastRequest';
const EVALS_CACHE_KEY = 'cachedEvaluations';

export class EvidentlyManager {
    private eventCache: EventCache;
    private dispatchManager: Dispatch;
    private config: Config;

    private lastRequest?: EvidentlyRequest;
    private cachedEvaluations: EvaluationResults = {};
    private lastPromise: Promise<EvaluationResults> = Promise.resolve({});
    private cacheValidCheck = 0;

    constructor(
        config: Config,
        eventCache: EventCache,
        dispatchManager: Dispatch
    ) {
        this.eventCache = eventCache;
        this.dispatchManager = dispatchManager;
        this.config = config;
    }

    public loadEvaluations(request: EvidentlyRequest) {
        let neededFeatureIds: string[] = request.features;

        // Check Cache
        const lastRequest: EvidentlyRequest | undefined = this.getLastRequest();
        if (lastRequest) {
            if (
                lastRequest.entityId === request.entityId &&
                this.compareContext(lastRequest.context, request.context)
            ) {
                // Can reuse cached evaluations
                const allCachedEvaluations = this.getCachedEvaluations();

                // Remove features that have a cached evaluation
                neededFeatureIds = neededFeatureIds.filter(
                    (id) => !allCachedEvaluations[id]
                );
            } else {
                // Request has changed, cached evaluations are now invalid
                this.clearCachedEvaluations();
                this.cacheValidCheck++;
            }
        }

        this.updateLastRequest(request);
        request.features = neededFeatureIds;

        const apiEvaluationsPromise =
            neededFeatureIds.length > 0
                ? this.getEvals(request)
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

    public getEvaluations(features: string[]): Promise<EvaluationResults> {
        const lastRequest: EvidentlyRequest | undefined = this.getLastRequest();
        if (!lastRequest) {
            return Promise.reject(
                `Evaluations for features (${features.join(', ')}) not loaded`
            );
        }

        const featureSet = new Set(lastRequest.features);
        const notLoadedFeatures = features.filter((f) => !featureSet.has(f));
        if (notLoadedFeatures.length > 0) {
            return Promise.reject(
                `Evaluations for features (${notLoadedFeatures.join(
                    ', '
                )}) not loaded`
            );
        }

        // If we have evaluations in cache, return them
        const allCachedEvaluations = this.getCachedEvaluations();
        // If every feature in features is in allCachedEvaluations then filter allCachedEvaluations to only have those features
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
                .filter((entry) => entry) as [string, EvaluationResult][]
        );
        if (features.length === Object.keys(requestedEvaluations).length) {
            this.addEvaluationToEvents(requestedEvaluations);
            return Promise.resolve(requestedEvaluations);
        }

        // Else:
        // If we are currently fetching the given features, return promise with results
        // Otherwise give error
        return this.lastPromise.then((evals: EvaluationResults) => {
            const responseEvaluations = Object.fromEntries(
                features.map((feature) => {
                    const evaluation =
                        evals[feature] || allCachedEvaluations[feature];
                    if (evaluation) {
                        return [feature, evaluation];
                    } else {
                        throw Error(
                            `Evaluations for feature (${feature}) was not loaded`
                        );
                    }
                })
            );
            this.addEvaluationToEvents(responseEvaluations);
            return responseEvaluations;
        });
    }

    private getCachedEvaluations(): EvaluationResults {
        if (
            this.useSessionStorage() &&
            Object.keys(this.cachedEvaluations).length === 0
        ) {
            try {
                const jsonEvals = sessionStorage.getItem(EVALS_CACHE_KEY);
                const sessionStorageEvals = JSON.parse(
                    jsonEvals as string
                ) as EvaluationResults;
                if (sessionStorageEvals) {
                    this.cachedEvaluations = sessionStorageEvals;
                }
            } catch (e) {
                // Ignore
            }
        }
        return this.cachedEvaluations;
    }

    private addToCachedEvaluations(evaluations: EvaluationResults) {
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

    private clearCachedEvaluations() {
        this.cachedEvaluations = {};
        if (this.useSessionStorage()) {
            sessionStorage.clear();
        }
    }

    private compareContext(c1?: ContextType, c2?: ContextType): boolean {
        // Note: Will return false if context has the same values but in a different order,
        //  we ignore this edge case to avoid complex equality checking
        return JSON.stringify(c1 || {}) === JSON.stringify(c2 || {});
    }

    private addEvaluationToEvents(evals: EvaluationResults) {
        const evidentlySessionAttributes: {
            [key: string]: string;
        } = Object.fromEntries(
            Object.values(evals).map((evaluation) => {
                return [evaluation.feature, evaluation.variation];
            })
        );
        this.eventCache.addEvidentlyAttributes(evidentlySessionAttributes);
    }

    private getEntityId(suppliedEntityId?: string): string {
        if (!suppliedEntityId) {
            const userDetails = this.eventCache.getUserDetails();
            return (userDetails.userId === NIL_UUID
                ? userDetails.sessionId
                : userDetails.userId) as string;
        } else {
            return suppliedEntityId;
        }
    }

    private getEvals(request: EvidentlyRequest): Promise<EvaluationResults> {
        const entityId = this.getEntityId(request.entityId);
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

        return this.dispatchManager
            .dispatchEvaluateFeature(apiRequest)
            .then((httpResponse) => {
                return new Response(httpResponse?.response.body).json();
            })
            .then((evaluations: BatchEvaluateFeatureResult) => {
                return evaluations.results.reduce(
                    (acc: EvaluationResults, cur) => {
                        const evaluation: EvaluationResult = {
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
            });
    }

    private useSessionStorage() {
        return navigator.cookieEnabled && this.config.allowCookies;
    }
}
