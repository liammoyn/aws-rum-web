import { HttpHandler, HttpRequest, HttpResponse } from '@aws-sdk/protocol-http';
import { EvidentlyClientBuilder } from '../dispatch/Dispatch';
import { logRequestToPage, logResponseToPage } from './http-handler-utils';
import { EvidentlyClient } from '../dispatch/EvidentlyClient';
import { BatchEvaluateFeatureRequest } from '../evidently/types';

export const showRequestEvidentlyClientBuilder: EvidentlyClientBuilder = (
    endpoint,
    region,
    credentials,
    project
) => {
    return new EvidentlyClient({
        fetchRequestHandler: new ShowMockEvidentlyRequestHandler(),
        endpoint,
        region,
        credentials,
        project
    });
};

class ShowMockEvidentlyRequestHandler implements HttpHandler {
    handle(request: HttpRequest): Promise<{ response: HttpResponse }> {
        const requestBody: BatchEvaluateFeatureRequest = JSON.parse(
            request.body
        );
        const responseBodyJson = JSON.stringify({
            results: requestBody.requests.map(
                (req: { feature: string }, idx: number) => ({
                    feature: req?.feature,
                    reason: 'LAUNCH_RULE_MATCH',
                    value: {
                        boolValue: false
                    },
                    variation: `variation${idx + 1}`
                })
            )
        });

        const response: HttpResponse = {
            statusCode: 200,
            headers: {
                'content-type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: responseBodyJson
        };
        logRequestToPage(request);
        logResponseToPage(response);
        return Promise.resolve({ response });
    }
}
