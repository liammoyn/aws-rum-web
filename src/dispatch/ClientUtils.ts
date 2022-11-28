import { toHex } from '@aws-sdk/util-hex-encoding';
import { RequestPresigningArguments } from '@aws-sdk/types';
import { Sha256 } from '@aws-crypto/sha256-js';
import {
    AppMonitorDetails,
    PutRumEventsRequest,
    UserDetails,
    RumEvent
} from './dataplane';

const METHOD = 'POST';
export const CONTENT_TYPE_JSON = 'application/json';
export const CONTENT_TYPE_TEXT = 'text/plain;charset=UTF-8';

export const REQUEST_PRESIGN_ARGS: RequestPresigningArguments = {
    expiresIn: 60
};

declare type SerializedRumEvent = {
    id: string;
    timestamp: number; // unix timestamp in seconds
    type: string;
    metadata?: string;
    details: string;
};

declare type SerializedPutRumEventsRequest = {
    BatchId: string;
    AppMonitorDetails: AppMonitorDetails;
    UserDetails: UserDetails;
    RumEvents: SerializedRumEvent[];
};

export const getHttpRequestOptions = async (
    requestToStringify: any,
    pathPostfix: string,
    endpoint: URL,
    contentType: string,
    useSigV4: boolean
) => {
    const serializedRequest: string = JSON.stringify(requestToStringify);
    const path = endpoint.pathname.replace(/\/$/, '');
    const options = {
        method: METHOD,
        protocol: endpoint.protocol,
        headers: {
            'content-type': contentType,
            host: endpoint.host
        },
        hostname: endpoint.hostname,
        path: `${path}/${pathPostfix}`,
        body: serializedRequest
    };
    if (useSigV4) {
        return {
            ...options,
            headers: {
                ...options.headers,
                'X-Amz-Content-Sha256': await hashAndEncode(serializedRequest)
            }
        };
    }
    return options;
};

export const serializeRequest = (
    request: PutRumEventsRequest
): SerializedPutRumEventsRequest => {
    //  If we were using the AWS SDK client here then the serialization would be handled for us through a generated
    //  serialization/deserialization library. However, since much of the generated code is unnecessary, we do the
    //  serialization ourselves with this function.
    const serializedRumEvents: SerializedRumEvent[] = [];
    request.RumEvents.forEach((e) =>
        serializedRumEvents.push(serializeEvent(e))
    );
    const serializedRequest: SerializedPutRumEventsRequest = {
        BatchId: request.BatchId,
        AppMonitorDetails: request.AppMonitorDetails,
        UserDetails: request.UserDetails,
        RumEvents: serializedRumEvents
    };
    return serializedRequest;
};

const serializeEvent = (event: RumEvent): SerializedRumEvent => {
    return {
        id: event.id,
        // Dates must be converted to timestamps before serialization.
        timestamp: Math.round(event.timestamp.getTime() / 1000),
        type: event.type,
        metadata: event.metadata,
        details: event.details
    };
};

const hashAndEncode = async (payload: string) => {
    const sha256 = new Sha256();
    sha256.update(payload);
    return toHex(await sha256.digest()).toLowerCase();
};
