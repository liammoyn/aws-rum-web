import { EvidentlyManager } from '../EvidentlyManager';
import {
    DEFAULT_CONFIG,
    createDefaultEventCache,
    createDefaultDispatch,
    DEFAULT_EVIDENTLY_CONFIG
} from '../../test-utils/test-utils';
import {
    EvaluateFeatureResult,
    EvaluationResults,
    InitializeFeaturesRequest
} from '../types';

const dispatchBatchEvaluateFeature = jest.fn();

jest.mock('../../dispatch/Dispatch', () => ({
    Dispatch: jest.fn().mockImplementation(() => ({
        dispatchBatchEvaluateFeature
    }))
}));

const addEvidentlyAttributes = jest.fn();
const resetEvidentlyAttributes = jest.fn();
const getUserDetails = jest.fn();

jest.mock('../../event-cache/EventCache', () => ({
    EventCache: jest.fn().mockImplementation(() => ({
        addEvidentlyAttributes,
        resetEvidentlyAttributes,
        getUserDetails
    }))
}));

const feature01 = 'feature01';
const feature02 = 'feature02';
const evidentlyRequest: InitializeFeaturesRequest = {
    entityId: '1234',
    context: { color: 'red' },
    features: [feature01, feature02]
};
const feature01Result: EvaluateFeatureResult = {
    feature: 'feature01',
    reason: 'DEFAULT',
    value: { boolValue: true },
    variation: 'variation01'
};
const feature02Result: EvaluateFeatureResult = {
    feature: 'feature02',
    reason: 'DEFAULT',
    value: { boolValue: false },
    variation: 'variation02'
};
const evaluationResults: EvaluationResults = {
    feature01: feature01Result,
    feature02: feature02Result
};
const feature03Result: EvaluateFeatureResult = {
    feature: 'feature03',
    reason: 'DEFAULT',
    value: { longValue: 10 },
    variation: 'variation03'
};

const notEnabledErrorText = 'Evidently is not enabled';
const tooManyFeaturesErrorText = 'Can only request up to 10 features at a time';
const featureNotLoadedErrorText = (feature: string) =>
    `Evaluation for feature [${feature}] not loaded`;

describe('EvidentlyManager tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('When Evidently is not enabled then initializeFeatures throws an error', async () => {
        const manager = new EvidentlyManager(
            DEFAULT_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        expect(() => manager.initializeFeatures(evidentlyRequest)).toThrow(
            notEnabledErrorText
        );
    });

    test('When Evidently is not enabled then evaluateFeature rejects promise', async () => {
        const manager = new EvidentlyManager(
            DEFAULT_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        await expect(() => manager.evaluateFeature(feature01)).rejects.toEqual(
            new Error(notEnabledErrorText)
        );
    });

    test('When given too many features, initializeFeatures throws an error', async () => {
        const fetchAPIEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'fetchAPIEvaluations'
        );
        fetchAPIEvaluations.mockImplementation(() => Promise.resolve({}));

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        const featureList = Array.from({ length: 10 }, (_, i) => `feature${i}`);
        const badFeatureList = Array.from(
            { length: 11 },
            (_, i) => `feature${i}`
        );

        expect(() =>
            manager.initializeFeatures({
                ...evidentlyRequest,
                features: featureList
            })
        ).not.toThrow(tooManyFeaturesErrorText);
        expect(() =>
            manager.initializeFeatures({
                ...evidentlyRequest,
                features: badFeatureList
            })
        ).toThrow(tooManyFeaturesErrorText);
    });

    test('When initializeFeatures called with null last request, cached evaluations are cleared', async () => {
        const getLastRequest = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequest.mockImplementation(() => undefined);
        const clearCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'clearCachedEvaluations'
        );
        clearCachedEvaluations.mockImplementation(() => undefined);
        const fetchAPIEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'fetchAPIEvaluations'
        );
        fetchAPIEvaluations.mockImplementation(() => Promise.resolve({}));

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        manager.initializeFeatures(evidentlyRequest);
        expect(getLastRequest).toHaveBeenCalled();
        expect(clearCachedEvaluations).toHaveBeenCalled();
    });

    test('When initializeFeatures called with different entity ID, cached evaluations are cleared', async () => {
        const getLastRequest = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequest.mockImplementation(() => ({
            ...evidentlyRequest,
            entityId: 'XXX'
        }));
        const clearCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'clearCachedEvaluations'
        );
        clearCachedEvaluations.mockImplementation(() => undefined);
        const fetchAPIEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'fetchAPIEvaluations'
        );
        fetchAPIEvaluations.mockImplementation(() => Promise.resolve({}));

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        manager.initializeFeatures(evidentlyRequest);
        expect(getLastRequest).toHaveBeenCalled();
        expect(clearCachedEvaluations).toHaveBeenCalled();
    });

    test('When initializeFeatures called with different context, cached evaluations are cleared', async () => {
        const getLastRequest = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequest.mockImplementation(() => ({
            ...evidentlyRequest,
            context: '{"color":"blue"}'
        }));
        const clearCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'clearCachedEvaluations'
        );
        clearCachedEvaluations.mockImplementation(() => undefined);
        const fetchAPIEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'fetchAPIEvaluations'
        );
        fetchAPIEvaluations.mockImplementation(() => Promise.resolve({}));

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        manager.initializeFeatures(evidentlyRequest);
        expect(getLastRequest).toHaveBeenCalled();
        expect(clearCachedEvaluations).toHaveBeenCalled();
    });

    test('When initializeFeatures called with cached features, no API request is made', async () => {
        const getLastRequest = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequest.mockImplementation(() => evidentlyRequest);
        const getCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getCachedEvaluations'
        );
        getCachedEvaluations.mockImplementation(() => evaluationResults);
        const clearCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'clearCachedEvaluations'
        );
        clearCachedEvaluations.mockImplementation(() => undefined);
        const fetchAPIEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'fetchAPIEvaluations'
        );
        fetchAPIEvaluations.mockImplementation(() => Promise.resolve({}));

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        manager.initializeFeatures(evidentlyRequest);
        expect(getLastRequest).toHaveBeenCalled();
        expect(getCachedEvaluations).toHaveBeenCalled();
        expect(clearCachedEvaluations).not.toHaveBeenCalled();
        expect(fetchAPIEvaluations).not.toHaveBeenCalled();
    });

    test('When initializeFeatures called with uncached features, API request is made', async () => {
        const getLastRequest = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequest.mockImplementation(() => evidentlyRequest);
        const getCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getCachedEvaluations'
        );
        getCachedEvaluations.mockImplementation(() => ({}));
        const fetchAPIEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'fetchAPIEvaluations'
        );
        fetchAPIEvaluations.mockImplementation(() =>
            Promise.resolve(evaluationResults)
        );

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        manager.initializeFeatures(evidentlyRequest);
        expect(getLastRequest).toHaveBeenCalled();
        expect(getCachedEvaluations).toHaveBeenCalled();
        expect(fetchAPIEvaluations).toHaveBeenCalled();
        const apiRequest = fetchAPIEvaluations.mock.calls[0][0];
        expect(apiRequest).toEqual(evidentlyRequest);
    });

    test('When initializeFeatures called with some cached features, API request is made with only needed features', async () => {
        const getLastRequest = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequest.mockImplementation(() => evidentlyRequest);
        const getCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getCachedEvaluations'
        );
        getCachedEvaluations.mockImplementation(() => ({
            feature01: feature01Result
        }));
        const fetchAPIEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'fetchAPIEvaluations'
        );
        fetchAPIEvaluations.mockImplementation(() =>
            Promise.resolve(evaluationResults)
        );

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        manager.initializeFeatures(evidentlyRequest);
        expect(getLastRequest).toHaveBeenCalled();
        expect(getCachedEvaluations).toHaveBeenCalled();
        expect(fetchAPIEvaluations).toHaveBeenCalled();
        const apiRequest = fetchAPIEvaluations.mock.calls[0][0];
        expect(apiRequest).toEqual({
            ...evidentlyRequest,
            features: ['feature02']
        });
    });

    test('When evaluateFeature is called without a lastRequest, then an error is thrown', async () => {
        const getLastRequestMock = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequestMock.mockImplementation(() => undefined);

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        await expect(() => manager.evaluateFeature(feature01)).rejects.toEqual(
            new Error(featureNotLoadedErrorText(feature01))
        );
        expect(getLastRequestMock).toHaveBeenCalled();
    });

    test('When evaluateFeature is called with features not loaded in last request, then an error is thrown', async () => {
        const getLastRequestMock = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequestMock.mockImplementation(() => ({
            features: [feature02]
        }));

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        await expect(() => manager.evaluateFeature(feature01)).rejects.toEqual(
            new Error(featureNotLoadedErrorText(feature01))
        );
        expect(getLastRequestMock).toHaveBeenCalled();
    });

    test('When evaluateFeature is called with same features in cache, then features returned', async () => {
        const getLastRequestMock = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequestMock.mockImplementation(() => evidentlyRequest);
        const getCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getCachedEvaluations'
        );
        getCachedEvaluations.mockImplementation(() => evaluationResults);

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        const actualEvaluations = await manager.evaluateFeature(feature01);
        expect(actualEvaluations).toEqual(evaluationResults[feature01]);
        expect(getLastRequestMock).toHaveBeenCalled();
        expect(getCachedEvaluations).toHaveBeenCalled();
    });

    test('When evaluateFeature is called with extra features in cache, then feature returned', async () => {
        const getLastRequestMock = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequestMock.mockImplementation(() => evidentlyRequest);
        const getCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getCachedEvaluations'
        );
        getCachedEvaluations.mockImplementation(() => ({
            ...evaluationResults,
            feautre03: feature03Result
        }));

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        const actualEvaluations = await manager.evaluateFeature(feature02);
        expect(actualEvaluations).toEqual(evaluationResults[feature02]);
        expect(getLastRequestMock).toHaveBeenCalled();
        expect(getCachedEvaluations).toHaveBeenCalled();
    });

    test('When evaluateFeature with API request getting same features, then features returned', async () => {
        const getLastRequestMock = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequestMock.mockImplementation(() => evidentlyRequest);
        const getCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getCachedEvaluations'
        );
        getCachedEvaluations.mockImplementation(() => ({}));
        const getLastPromise = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastPromise'
        );
        getLastPromise.mockImplementation(() =>
            Promise.resolve(evaluationResults)
        );

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        const actualEvaluations = await manager.evaluateFeature(feature01);
        expect(actualEvaluations).toEqual(evaluationResults[feature01]);
        expect(getLastRequestMock).toHaveBeenCalled();
        expect(getCachedEvaluations).toHaveBeenCalled();
        expect(getLastPromise).toHaveBeenCalled();
    });

    test('When evaluateFeature with rejected API request, then promise is rejected', async () => {
        const getLastRequestMock = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequestMock.mockImplementation(() => evidentlyRequest);
        const getCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getCachedEvaluations'
        );
        getCachedEvaluations.mockImplementation(() => ({}));
        const getLastPromise = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastPromise'
        );
        getLastPromise.mockImplementation(() =>
            Promise.reject(new Error('MockError'))
        );

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        await expect(() => manager.evaluateFeature(feature01)).rejects.toEqual(
            new Error('MockError')
        );
        expect(getLastRequestMock).toHaveBeenCalled();
        expect(getCachedEvaluations).toHaveBeenCalled();
        expect(getLastPromise).toHaveBeenCalled();
    });

    test('When evaluateFeature with API request missing a feature, then promise is rejected', async () => {
        const getLastRequestMock = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastRequest'
        );
        getLastRequestMock.mockImplementation(() => evidentlyRequest);
        const getCachedEvaluations = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getCachedEvaluations'
        );
        getCachedEvaluations.mockImplementation(() => ({}));
        const getLastPromise = jest.spyOn(
            EvidentlyManager.prototype as any,
            'getLastPromise'
        );
        getLastPromise.mockImplementation(() =>
            Promise.resolve({ feature01: feature01Result })
        );

        const manager = new EvidentlyManager(
            DEFAULT_EVIDENTLY_CONFIG,
            createDefaultEventCache(),
            createDefaultDispatch()
        );

        await expect(() => manager.evaluateFeature(feature02)).rejects.toEqual(
            new Error(featureNotLoadedErrorText('feature02'))
        );
        expect(getLastRequestMock).toHaveBeenCalled();
        expect(getCachedEvaluations).toHaveBeenCalled();
        expect(getLastPromise).toHaveBeenCalled();
    });
});
