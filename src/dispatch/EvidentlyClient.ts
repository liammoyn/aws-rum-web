import { SignatureV4 } from '@aws-sdk/signature-v4';
import { CredentialProvider, Credentials, HttpResponse } from '@aws-sdk/types';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpHandler, HttpRequest } from '@aws-sdk/protocol-http';
import { BatchEvaluateFeatureRequest } from '../evidently/types';
import { CONTENT_TYPE_JSON, getHttpRequestOptions } from './ClientUtils';

const EVIDENTLY_SERVICE = 'evidently';

export declare type EvidentlyClientConfig = {
    fetchRequestHandler: HttpHandler;
    endpoint: URL;
    region: string;
    credentials: CredentialProvider | Credentials | undefined;
    project?: string;
};

export class EvidentlyClient {
    private config: EvidentlyClientConfig;
    private awsSigV4: SignatureV4 | undefined;

    constructor(config: EvidentlyClientConfig) {
        this.config = config;
        if (config.credentials) {
            this.awsSigV4 = new SignatureV4({
                applyChecksum: true,
                credentials: config.credentials,
                region: config.region,
                service: EVIDENTLY_SERVICE,
                uriEscapePath: true,
                sha256: Sha256
            });
        }
    }

    public batchEvaluateFeature = async (
        evaluationsRequest: BatchEvaluateFeatureRequest
    ): Promise<{ response: HttpResponse }> => {
        if (!this.config.project) {
            throw Error('Evidently not enabled');
        }
        const options = await getHttpRequestOptions(
            evaluationsRequest,
            `projects/${this.config.project}/evaluations`,
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
}
