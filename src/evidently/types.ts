export type EvaluationCallback = (
    err?: Error,
    res?: EvaluateFeatureResult
) => void;

export type PartialEvidentlyConfig = {
    project: string;
    endpoint?: string;
};
export type EvidentlyConfig = {
    project?: string;
    endpoint: string;
    endpointUrl: URL;
};
export type InitializeFeaturesRequest = {
    features: string[];
    entityId?: string;
    context?: string;
};
export function isValidInitalizeFeaturesRequest(
    request: any
): request is InitializeFeaturesRequest {
    return (
        typeof request === 'object' &&
        (!request.context || typeof request.context === 'string') &&
        (!request.entityId || typeof request.entityId === 'string') &&
        Array.isArray(request.features) &&
        request.features.every((f: any) => typeof f === 'string')
    );
}

type VariableValue = {
    boolValue?: boolean;
    doubleValue?: number;
    longValue?: number;
    stringValue?: string;
};
export type EvaluateFeatureResult = {
    feature: string;
    reason: string;
    value: VariableValue;
    variation: string;
};
export type EvaluationResults = {
    [feature: string]: EvaluateFeatureResult;
};

export type EvaluationRequest = {
    entityId: string;
    evaluationContext?: string;
    feature: string;
};
export type BatchEvaluateFeatureRequest = {
    requests: EvaluationRequest[];
};

export type BatchEvaluationResult = {
    details: string;
    entityId: string;
    feature: string;
    project: string;
    reason: string;
    value: VariableValue;
    variation: string;
};
export type BatchEvaluateFeatureResult = {
    results: BatchEvaluationResult[];
};
