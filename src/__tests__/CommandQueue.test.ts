import { AwsRumClientInit, CommandQueue } from '../CommandQueue';
import { Orchestration } from '../orchestration/Orchestration';
import {
    mockOtaConfigFile,
    mockOtaConfigObject,
    mockPartialOtaConfigFile,
    mockPartialOtaConfigObject,
    dummyOtaConfigURL
} from '../test-utils/mock-remote-config';
import { Response } from 'node-fetch';
import * as RemoteConfig from '../remote-config/remote-config';
import * as EvidentlyTypes from '../evidently/types';

const mockFetch = jest.fn();

global.fetch = mockFetch;

const initArgs: AwsRumClientInit = {
    q: [],
    n: 'cwr',
    i: 'application_id',
    v: '1.0',
    r: 'us-west-2'
};

const initArgsWithAppName: AwsRumClientInit = {
    q: [],
    n: 'cwr',
    i: 'application_id',
    a: 'application_name',
    v: '1.0',
    r: 'us-west-2'
};

const getCommandQueue = () => {
    const cq: CommandQueue = new CommandQueue();
    cq.init(initArgs);
    return cq;
};

const disable = jest.fn();
const enable = jest.fn();
const dispatch = jest.fn();
const dispatchBeacon = jest.fn();
const setAwsCredentials = jest.fn();
const addSessionAttributes = jest.fn();
const allowCookies = jest.fn();
const recordPageView = jest.fn();
const recordError = jest.fn();
const registerDomEvents = jest.fn();
const recordEvent = jest.fn();
const initializeFeatures = jest.fn();
const evaluateFeature = jest.fn();
jest.mock('../orchestration/Orchestration', () => ({
    Orchestration: jest.fn().mockImplementation(() => ({
        disable,
        enable,
        dispatch,
        dispatchBeacon,
        setAwsCredentials,
        addSessionAttributes,
        allowCookies,
        recordPageView,
        recordError,
        registerDomEvents,
        recordEvent,
        initializeFeatures,
        evaluateFeature
    }))
}));

describe('CommandQueue tests', () => {
    beforeEach(() => {
        window.performance.getEntriesByType = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('disable calls Orchestration.disable', async () => {
        const cq: CommandQueue = getCommandQueue();
        const result = await cq.push({
            c: 'disable',
            p: undefined
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(disable).toHaveBeenCalled();
    });

    test('when configUri is present then returns config', async () => {
        const getConfigStub = jest
            .spyOn(RemoteConfig, 'getRemoteConfig')
            .mockReturnValue(Promise.resolve(mockOtaConfigObject));

        await new CommandQueue().init({
            ...initArgs,
            c: {},
            u: dummyOtaConfigURL
        });

        expect(getConfigStub).toBeCalledTimes(1);
        expect(Orchestration).toHaveBeenCalledTimes(1);
        expect((Orchestration as any).mock.calls[0][3]).toEqual(
            mockOtaConfigObject
        );

        getConfigStub.mockRestore();
    });

    test('when configUri is present then it downloads the file', async () => {
        (fetch as any).mockReturnValue(
            Promise.resolve(new Response(JSON.stringify(mockOtaConfigFile)))
        );

        await new CommandQueue().init({
            ...initArgs,
            c: {},
            u: dummyOtaConfigURL
        });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(dummyOtaConfigURL, {
            mode: 'cors',
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        });
        expect(Orchestration).toHaveBeenCalledTimes(1);

        expect((Orchestration as any).mock.calls[0][3]).toEqual(
            mockOtaConfigObject
        );
    });

    test('when optional parameters are present then create a config with received inputs', async () => {
        (fetch as any).mockReturnValue(
            Promise.resolve(
                new Response(JSON.stringify(mockPartialOtaConfigFile))
            )
        );

        await new CommandQueue().init({
            ...initArgs,
            c: {},
            u: dummyOtaConfigURL
        });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(dummyOtaConfigURL, {
            mode: 'cors',
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        });
        expect((Orchestration as any).mock.calls[0][3]).toEqual(
            mockPartialOtaConfigObject
        );
    });

    test('when parameters in both snippet and OTA file then it combines both, prefers snippet details', async () => {
        (fetch as any).mockReturnValue(
            Promise.resolve(
                new Response(JSON.stringify(mockPartialOtaConfigFile))
            )
        );

        await new CommandQueue().init({
            ...initArgs,
            c: {
                dispatchInterval: 10 * 1000,
                sessionSampleRate: 0.8,
                enableRumClient: false
            },
            u: dummyOtaConfigURL
        });

        expect((Orchestration as any).mock.calls[0][3]).toEqual(
            expect.objectContaining({
                dispatchInterval: 10 * 1000,
                sessionSampleRate: 0.8,
                enableRumClient: false // prefer snippet config
            })
        );
    });

    test('when configUri  fails to download an error is thrown', async () => {
        (fetch as any).mockReturnValue(Promise.reject('403'));

        const cq: CommandQueue = new CommandQueue();

        await expect(
            cq.init({
                ...initArgs,
                c: {},
                u: dummyOtaConfigURL
            })
        ).rejects.toEqual(Error('CWR: Failed to load remote config: 403'));
    });

    test('push() recordLog throws UnsupportedOperationException', async () => {
        const commandQueue: CommandQueue = getCommandQueue();
        return expect(
            commandQueue.push({
                c: 'recordLog',
                p: { event: 'my_log' }
            })
        ).rejects.toEqual(
            new Error('CWR: UnsupportedOperationException: recordLog')
        );
    });

    test('enable calls Orchestration.enable', async () => {
        const cq: CommandQueue = getCommandQueue();
        const result = await cq.push({
            c: 'enable',
            p: undefined
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(enable).toHaveBeenCalled();
    });

    test('dispatch calls Orchestration.dispatch', async () => {
        const cq: CommandQueue = getCommandQueue();
        const result = await cq.push({
            c: 'dispatch',
            p: undefined
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalled();
    });

    test('dispatchBeacon calls Orchestration.dispatchBeacon', async () => {
        const cq: CommandQueue = getCommandQueue();
        const result = await cq.push({
            c: 'dispatchBeacon',
            p: undefined
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(dispatchBeacon).toHaveBeenCalled();
    });

    test('setAwsCredentials calls Orchestration.setAwsCredentials', async () => {
        const cq: CommandQueue = getCommandQueue();
        const result = await cq.push({
            c: 'setAwsCredentials',
            p: { event: 'my_event' }
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(setAwsCredentials).toHaveBeenCalled();
    });

    test('addSessionAttributes calls Orchestration.addSessionAttributes', async () => {
        const cq: CommandQueue = getCommandQueue();
        const result = await cq.push({
            c: 'addSessionAttributes',
            p: { customAttribute: 'customAttributeValue' }
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(addSessionAttributes).toHaveBeenCalled();
    });

    test('allowCookies calls Orchestration.allowCookies', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq.push({
            c: 'allowCookies',
            p: false
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(allowCookies).toHaveBeenCalled();
    });

    test('recordPageView calls Orchestration.recordPageView', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq.push({
            c: 'recordPageView',
            p: '/console/home'
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(recordPageView).toHaveBeenCalled();
    });

    test('recordError calls Orchestration.recordError', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq.push({
            c: 'recordError',
            p: false
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(recordError).toHaveBeenCalled();
    });

    test('registerDomEvents calls Orchestration.registerDomEvents', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq.push({
            c: 'registerDomEvents',
            p: [false]
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(registerDomEvents).toHaveBeenCalled();
    });

    test('allowCookies fails when paylod is non-boolean', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq
            .push({
                c: 'allowCookies',
                p: ['']
            })
            .then((v) => fail('command should fail'))
            .catch((e) =>
                expect(e.message).toEqual('IncorrectParametersException')
            );
    });

    test('initializeFeatures calls Orchestration.initializeFeatures', async () => {
        const cq: CommandQueue = getCommandQueue();
        jest.spyOn(
            EvidentlyTypes,
            'isValidInitalizeFeaturesRequest'
        ).mockReturnValue(true);
        await cq.push({
            c: 'initializeFeatures',
            p: {}
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(initializeFeatures).toHaveBeenCalled();
    });

    test('initializeFeatures fails when not given incorrect body parameters', async () => {
        const cq: CommandQueue = getCommandQueue();
        jest.spyOn(
            EvidentlyTypes,
            'isValidInitalizeFeaturesRequest'
        ).mockReturnValue(false);
        await cq
            .push({
                c: 'evaluateFeature',
                p: {}
            })
            .then((v) => fail('command should fail'))
            .catch((e) =>
                expect(e.message).toEqual('IncorrectParametersException')
            );
    });

    test('evaluateFeature fails when not given a callback', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq
            .push({
                c: 'evaluateFeature',
                p: { feature: 'feature01' }
            })
            .then((v) => fail('command should fail'))
            .catch((e) =>
                expect(e.message).toEqual('IncorrectParametersException')
            );
    });

    test('evaluateFeature fails when not given features', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq
            .push({
                c: 'evaluateFeature',
                p: { callback: jest.fn() }
            })
            .then((v) => fail('command should fail'))
            .catch((e) =>
                expect(e.message).toEqual('IncorrectParametersException')
            );
    });

    test('evaluateFeature fails when not given payload', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq
            .push({
                c: 'evaluateFeature',
                p: undefined
            })
            .then((v) => fail('command should fail'))
            .catch((e) =>
                expect(e.message).toEqual('IncorrectParametersException')
            );
    });

    test('evaluateFeature will trigger callback when promise is resolved', async () => {
        const responseValue = 'TestResponse';
        (evaluateFeature as any).mockReturnValue(
            Promise.resolve(responseValue)
        );
        const mockCallback = jest.fn();

        const cq: CommandQueue = getCommandQueue();
        await cq.push({
            c: 'evaluateFeature',
            p: { feature: 'feature01', callback: mockCallback }
        });

        expect(Orchestration).toHaveBeenCalled();
        expect(evaluateFeature).toHaveBeenCalled();
        expect(mockCallback).toHaveBeenCalledWith(undefined, responseValue);
    });

    test('evaluateFeature will trigger callback when promise is rejected', async () => {
        const rejectError = new Error('TestError');
        (evaluateFeature as any).mockImplementation(
            () =>
                new Promise(() => {
                    throw rejectError;
                })
        );
        const mockCallback = jest.fn();

        const cq: CommandQueue = getCommandQueue();
        await cq.push({
            c: 'evaluateFeature',
            p: { feature: 'feature01', callback: mockCallback }
        });

        expect(Orchestration).toHaveBeenCalled();
        expect(evaluateFeature).toHaveBeenCalled();
        await new Promise((r) => setTimeout(r, 500));
        expect(mockCallback).toHaveBeenCalledWith(rejectError, undefined);
    });

    test('when function is unknown, UnsupportedOperationException is thrown', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq
            .push({
                c: 'badCommand',
                p: undefined
            })
            .then((v) => fail('command should fail'))
            .catch((e) =>
                expect(e.message).toEqual(
                    'CWR: UnsupportedOperationException: badCommand'
                )
            );
    });

    test('when application name is in the initialization object then it is ignored', async () => {
        const cq: CommandQueue = getCommandQueue();
        await cq.init({ ...initArgsWithAppName });
        const result = await cq.push({
            c: 'disable',
            p: undefined
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(disable).toHaveBeenCalled();
        expect((Orchestration as any).mock.calls[0]).toEqual([
            'application_id',
            '1.0',
            'us-west-2',
            undefined
        ]);
    });

    test('when recordEvent receives valid input then event is recorded', async () => {
        const commandQueue: CommandQueue = getCommandQueue();
        await commandQueue.init({ ...initArgsWithAppName });
        await commandQueue.push({
            c: 'recordEvent',
            p: {
                type: 'my_custom_event',
                data: {
                    version: 1.0,
                    field1: { subfield1: 'subfield value' }
                }
            }
        });
        expect(Orchestration).toHaveBeenCalled();
        expect(recordEvent).toHaveBeenCalled();
        const mockEventType = recordEvent.mock.calls[0][0];
        const mockEventData = recordEvent.mock.calls[0][1];
        expect(mockEventType).toEqual('my_custom_event');
        expect(mockEventData.version).toEqual(1.0);
    });

    test('when recordEvent payload is empty then throws IncorrectParameterException', async () => {
        const commandQueue: CommandQueue = getCommandQueue();
        await commandQueue.init({ ...initArgsWithAppName });
        return expect(
            commandQueue.push({
                c: 'recordEvent',
                p: {}
            })
        ).rejects.toEqual(new Error('IncorrectParametersException'));
    });

    test('when recordEvent payload.event_type is not a string then throws IncorrectParameterException', async () => {
        const commandQueue: CommandQueue = getCommandQueue();
        await commandQueue.init({ ...initArgsWithAppName });
        return expect(
            commandQueue.push({
                c: 'recordEvent',
                p: {
                    event_type: { is_string: 'false' },
                    event_data: { is_string: 'false' }
                }
            })
        ).rejects.toEqual(new Error('IncorrectParametersException'));
    });

    test('when recordEvent payload.event_data is not an object then throws IncorrectParameterException', async () => {
        const commandQueue: CommandQueue = getCommandQueue();
        await commandQueue.init({ ...initArgsWithAppName });
        return expect(
            commandQueue.push({
                c: 'recordEvent',
                p: {
                    event_type: 'custom_event_type',
                    event_data: 'Not an object'
                }
            })
        ).rejects.toEqual(new Error('IncorrectParametersException'));
    });

    test('when recordEvent payload is not an object then throws IncorrectParameterException', async () => {
        const commandQueue: CommandQueue = getCommandQueue();
        await commandQueue.init({ ...initArgsWithAppName });
        return expect(
            commandQueue.push({
                c: 'recordEvent',
                p: 'not object'
            })
        ).rejects.toEqual(new Error('IncorrectParametersException'));
    });
});
