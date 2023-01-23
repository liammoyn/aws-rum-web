import { loader } from './loader';
import { showRequestClientBuilder } from '../test-utils/mock-http-handler';
import { showRequestEvidentlyClientBuilder } from '../test-utils/mock-evidently-handler.ts';
loader('cwr', 'abc123', '1.0', 'us-west-2', './rum_javascript_telemetry.js', {
    allowCookies: true,
    dispatchInterval: 0,
    clientBuilder: showRequestClientBuilder,
    sessionAttributes: {
        customAttributeAtInit: 'customAttributeAtInitValue'
    },
    evidentlyClientBuilder: showRequestEvidentlyClientBuilder,
    evidentlyConfig: {
        project: 'project01'
    }
});
window.cwr('setAwsCredentials', {
    accessKeyId: 'a',
    secretAccessKey: 'b',
    sessionToken: 'c'
});
