import * as Utils from '../../test-utils/test-utils';
import { BeaconHttpHandler } from '../BeaconHttpHandler';
import { FetchHttpHandler } from '@aws-sdk/fetch-http-handler';
import { DataPlaneClient } from '../DataPlaneClient';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { advanceTo } from 'jest-date-mock';
import { EvidentlyClient } from '../EvidentlyClient';

const fetchHandler = jest.fn(() => Promise.resolve());
jest.mock('@aws-sdk/fetch-http-handler', () => ({
    FetchHttpHandler: jest
        .fn()
        .mockImplementation(() => ({ handle: fetchHandler }))
}));

interface Config {
    signing: boolean;
    endpoint: URL;
}

const defaultConfig = { signing: true, endpoint: Utils.AWS_EVIDENTLY_ENDPOINT };
const mockProjectName = 'project01';
const createEvidentlyClient = (
    config: Config = defaultConfig
): EvidentlyClient => {
    return new EvidentlyClient({
        fetchRequestHandler: new FetchHttpHandler(),
        endpoint: config.endpoint,
        region: Utils.AWS_RUM_REGION,
        credentials: config.signing ? Utils.createAwsCredentials() : undefined,
        project: mockProjectName
    });
};

describe('EvidentlyClient tests', () => {
    beforeEach(() => {
        advanceTo(0);
        fetchHandler.mockClear();

        // @ts-ignore
        FetchHttpHandler.mockImplementation(() => {
            return {
                handle: fetchHandler
            };
        });
    });

    test('when fetchEvaluations is used then fetch handler is used', async () => {
        // Init
        const client: EvidentlyClient = createEvidentlyClient();

        // Run
        await client.batchEvaluateFeature(Utils.EVALUATE_FEATURE_REQUEST);

        // Assert
        expect(fetchHandler).toHaveBeenCalledTimes(1);
    });

    test('when fetchEvaluations is used then request contains correct signature header', async () => {
        // Init
        const client: EvidentlyClient = createEvidentlyClient();

        // Run
        await client.batchEvaluateFeature(Utils.EVALUATE_FEATURE_REQUEST);

        // Assert
        const signedRequest: HttpRequest = (fetchHandler.mock
            .calls[0] as any)[0];
        expect(signedRequest.headers['x-amz-date']).toEqual('19700101T000000Z');
        expect(signedRequest.headers['X-Amz-Content-Sha256']).toEqual(
            '9d6c9871213645b9361b8f251011535a8822c7bdf3439e3756ca530395303a67'
        );
        expect(signedRequest.headers.authorization).toEqual(
            'AWS4-HMAC-SHA256 Credential=abc123/19700101/us-west-2/evidently/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=fce5fe7a0bfb527adf2b318e1039e7f0cb69c7e52ac0f157b377c04fd770a5e0'
        );
    });

    test('when the endpoint contains a path then the fetch request url contains the path prefix', async () => {
        // Init
        const endpoint = new URL(`${Utils.AWS_EVIDENTLY_ENDPOINT}${'prod'}`);
        const client: EvidentlyClient = createEvidentlyClient({
            ...defaultConfig,
            endpoint
        });

        // Run
        await client.batchEvaluateFeature(Utils.EVALUATE_FEATURE_REQUEST);

        // Assert
        const signedRequest: HttpRequest = (fetchHandler.mock
            .calls[0] as any)[0];
        expect(signedRequest.hostname).toEqual(
            Utils.AWS_EVIDENTLY_ENDPOINT.hostname
        );
        expect(signedRequest.path).toEqual(
            `${endpoint.pathname}/projects/${mockProjectName}/evaluations`
        );
    });

    test('when the endpoint path contains a trailing slash then the fetch request url drops the trailing slash', async () => {
        // Init
        const endpoint = new URL(`${Utils.AWS_EVIDENTLY_ENDPOINT}${'prod/'}`);
        const client: EvidentlyClient = createEvidentlyClient({
            ...defaultConfig,
            endpoint
        });

        // Run
        await client.batchEvaluateFeature(Utils.EVALUATE_FEATURE_REQUEST);

        // Assert
        const signedRequest: HttpRequest = (fetchHandler.mock
            .calls[0] as any)[0];
        expect(signedRequest.hostname).toEqual(
            Utils.AWS_EVIDENTLY_ENDPOINT.hostname
        );
        expect(signedRequest.path).toEqual(
            `${endpoint.pathname.replace(
                /\/$/,
                ''
            )}/projects/${mockProjectName}/evaluations`
        );
    });

    test('when signing is disabled then fetchEvaluations does not sign the request', async () => {
        // Init
        const client: EvidentlyClient = createEvidentlyClient({
            ...defaultConfig,
            signing: false
        });

        // Run
        await client.batchEvaluateFeature(Utils.EVALUATE_FEATURE_REQUEST);

        // Assert
        const signedRequest: HttpRequest = (fetchHandler.mock
            .calls[0] as any)[0];
        expect(signedRequest.headers['X-Amz-Content-Sha256']).toEqual(
            undefined
        );
        expect(signedRequest.headers['x-amz-date']).toEqual(undefined);
        expect(signedRequest.headers.authorization).toEqual(undefined);
    });
});
