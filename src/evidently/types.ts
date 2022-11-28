export type EvaluationCallback = (err?: Error, res?: EvaluationResults) => void;

export type ContextType = { [k: string]: any };
export type PartialEvidentlyConfig = {
    project: string;
    endpoint?: URL;
};
export type EvidentlyConfig = {
    project?: string;
    endpoint: URL;
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
export type EvaluationResult = {
    feature: string;
    reason: string;
    value: VariationValue;
    variation: string;
};
export type EvaluationResults = { [feature: string]: EvaluationResult };

export type APIEvaluationRequest = {
    entityId: string;
    evaluationContext?: string;
    feature: string;
};
export type BatchEvaluateFeatureRequest = {
    requests: APIEvaluationRequest[];
};

export type APIEvaluationResult = {
    details: string;
    entityId: string;
    feature: string;
    project: string;
    reason: string;
    value: VariationValue;
    variation: string;
};
export type BatchEvaluateFeatureResult = {
    results: APIEvaluationResult[];
};
