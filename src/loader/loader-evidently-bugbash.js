import { loader } from './loader';
loader(
    'cwr',
    'abc123', // Application ID
    '1.0',
    'us-east-1',
    './rum_javascript_telemetry.js', // Leave this here
    {
        endpoint: 'https://dataplane.rum-gamma.us-east-1.amazonaws.com/', // Leave this

        // Add config below...

        evidentlyConfig: {
            project: 'project01'
            // endpoint: 'https://dataplane.evidently-gamma.us-east-1.amazonaws.com' // Optional
        }
    }
);

// Can uncomment to use AWS account credentials instead of cognito
/*
window.cwr('setAwsCredentials', {
    accessKeyId: 'a',
    secretAccessKey: 'b',
    sessionToken: 'c'
});
*/
