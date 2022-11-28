export type EvaluationCallback = (
    err?: Error,
    res?: ClientEvaluationResults
) => void;

export type ContextType = { [k: string]: any };
export type PartialEvidentlyConfig = {
    project: string;
    endpoint?: string;
};
export type EvidentlyConfig = {
    project?: string;
    endpoint: string;
    endpointUrl: URL;
};
export type EvidentlyRequest = {
    features: string[];
    entityId?: string;
    context?: ContextType;
};
type VariationValue = {
    boolValue?: boolean;
    doubleValue?: number;
    longValue?: number;
    stringValue?: string;
};
export type ClientEvaluationResult = {
    feature: string;
    reason: string;
    value: VariationValue;
    variation: string;
};
export type ClientEvaluationResults = {
    [feature: string]: ClientEvaluationResult;
};

export type EvaluationRequest = {
    entityId: string;
    evaluationContext?: string;
    feature: string;
};
export type BatchEvaluateFeatureRequest = {
    requests: EvaluationRequest[];
};

export type EvaluationResult = {
    details: string;
    entityId: string;
    feature: string;
    project: string;
    reason: string;
    value: VariationValue;
    variation: string;
};
export type BatchEvaluateFeatureResult = {
    results: EvaluationResult[];
};
