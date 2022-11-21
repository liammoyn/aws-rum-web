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

    constructor(
        config: Config,
        eventCache: EventCache,
        dispatchManager: Dispatch
    ) {
        this.eventCache = eventCache;
        this.dispatchManager = dispatchManager;
        this.config = config;
    }

    public evaluateFeature(
        request: EvidentlyRequest
    ): Promise<EvaluationResults> {
        const requestedCachedEvaluations: EvaluationResults = {};
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

                // Remove features that have a cached evaluation, record evaluation in requestedCachedEvaluations
                neededFeatureIds = neededFeatureIds.filter((id) => {
                    if (allCachedEvaluations[id]) {
                        requestedCachedEvaluations[id] =
                            allCachedEvaluations[id];
                        return false;
                    } else {
                        return true;
                    }
                });
            } else {
                // Request has changed, cached evaluations are now invalid
                this.clearCachedEvaluations();
            }
        }

        this.updateLastRequest(request);
        request.features = neededFeatureIds;

        // Make API call if necessary
        const apiEvaluationsPromise =
            neededFeatureIds.length > 0
                ? this.getEvals(request)
                : Promise.resolve({});

        return apiEvaluationsPromise.then((apiEvaluations) => {
            // Add new evaluations to cache
            this.addToCachedEvaluations(apiEvaluations);
            // Return both API and cached evaluations
            const evaluationsToReturn = {
                ...apiEvaluations,
                ...requestedCachedEvaluations
            };
            // Add the evaluations to the event custom attributes
            this.addEvaluationToEvents(evaluationsToReturn);
            return evaluationsToReturn;
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
        this.eventCache.replaceEvidentlySessionAttributes(
            evidentlySessionAttributes
        );
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
