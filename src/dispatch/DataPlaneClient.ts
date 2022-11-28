import { SignatureV4 } from '@aws-sdk/signature-v4';
import { CredentialProvider, Credentials, HttpResponse } from '@aws-sdk/types';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpHandler, HttpRequest } from '@aws-sdk/protocol-http';
import { PutRumEventsRequest } from './dataplane';
import {
    CONTENT_TYPE_JSON,
    CONTENT_TYPE_TEXT,
    getHttpRequestOptions,
    REQUEST_PRESIGN_ARGS,
    serializeRequest
} from './ClientUtils';

const RUM_SERVICE = 'rum';

export declare type DataPlaneClientConfig = {
    fetchRequestHandler: HttpHandler;
    beaconRequestHandler: HttpHandler;
    endpoint: URL;
    region: string;
    credentials: CredentialProvider | Credentials | undefined;
};

export class DataPlaneClient {
    private config: DataPlaneClientConfig;
    private awsSigV4: SignatureV4 | undefined;

    constructor(config: DataPlaneClientConfig) {
        this.config = config;
        if (config.credentials) {
            this.awsSigV4 = new SignatureV4({
                applyChecksum: true,
                credentials: config.credentials,
                region: config.region,
                service: RUM_SERVICE,
                uriEscapePath: true,
                sha256: Sha256
            });
        }
    }

    public sendFetch = async (
        putRumEventsRequest: PutRumEventsRequest
    ): Promise<{ response: HttpResponse }> => {
        const options = await getHttpRequestOptions(
            serializeRequest(putRumEventsRequest),
            `appmonitors/${putRumEventsRequest.AppMonitorDetails.id}`,
            this.config.endpoint,
            CONTENT_TYPE_JSON,
            this.awsSigV4 !== undefined
        );
        let request: HttpRequest = new HttpRequest(options);
        if (this.awsSigV4) {
            request = (await this.awsSigV4.sign(request)) as HttpRequest;
        }
        const httpResponse: Promise<{
            response: HttpResponse;
        }> = this.config.fetchRequestHandler.handle(request);
        return httpResponse;
    };

    public sendBeacon = async (
        putRumEventsRequest: PutRumEventsRequest
    ): Promise<{ response: HttpResponse }> => {
        const options = await getHttpRequestOptions(
            serializeRequest(putRumEventsRequest),
            `appmonitors/${putRumEventsRequest.AppMonitorDetails.id}`,
            this.config.endpoint,
            CONTENT_TYPE_TEXT,
            this.awsSigV4 !== undefined
        );
        let request: HttpRequest = new HttpRequest(options);
        if (this.awsSigV4) {
            request = (await this.awsSigV4.presign(
                request,
                REQUEST_PRESIGN_ARGS
            )) as HttpRequest;
        }
        const httpResponse: Promise<{
            response: HttpResponse;
        }> = this.config.beaconRequestHandler.handle(request);
        return httpResponse;
    };
}
