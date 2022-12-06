import { Selector } from 'testcafe';
import {
    STATUS_200,
    PAYLOAD,
    REQUEST_BODY,
    RESPONSE_STATUS
} from '../../test-utils/integ-test-utils';

const CLEAR_STORAGE_BUTTON: Selector = Selector(`#clearSessionStorage`);
const INITIALIZE_BUTTON: Selector = Selector(`#initializeFeatures`);
const EVALUATE_BUTTON: Selector = Selector(`#evaluateFeature`);

const FEATURE_NAME: Selector = Selector(`#featureName`);

const EVALUATE_ERROR: Selector = Selector('#callback_error');
const EVALUATE_RESPONSE: Selector = Selector('#callback_response');

const UNDEFINED = 'undefined';
const feature01 = 'feature01';
const feature02 = 'feature02';

fixture('Evidently Manager').page('http://localhost:8080/evidently.html');

test('When session storage is empty, API call should be made and evaluateFeature should return result', async (t: TestController) => {
    await t.wait(300);

    await t.click(CLEAR_STORAGE_BUTTON);

    const entityId = 'user01';
    const context = {
        color: 'red'
    };
    const requestBody = {
        features: [feature01, feature02],
        entityId,
        context
    };
    const requestBodyJson = JSON.stringify(requestBody);

    await t
        .typeText(PAYLOAD, requestBodyJson, { replace: true })
        .click(INITIALIZE_BUTTON);

    await t.wait(300);

    await t
        .expect(REQUEST_BODY.textContent)
        .contains(feature01)
        .expect(REQUEST_BODY.textContent)
        .contains(entityId)
        .expect(REQUEST_BODY.textContent)
        .contains(JSON.stringify(JSON.stringify(context)))
        .expect(RESPONSE_STATUS.textContent)
        .eql(STATUS_200.toString());

    await t
        .typeText(FEATURE_NAME, feature01, { replace: true })
        .click(EVALUATE_BUTTON);

    await t.wait(300);

    await t
        .expect(EVALUATE_ERROR.textContent)
        .eql(UNDEFINED)
        .expect(EVALUATE_RESPONSE.textContent)
        .contains(feature01);

    await t
        .typeText(FEATURE_NAME, feature02, { replace: true })
        .click(EVALUATE_BUTTON);

    await t.wait(300);

    await t
        .expect(EVALUATE_ERROR.textContent)
        .eql(UNDEFINED)
        .expect(EVALUATE_RESPONSE.textContent)
        .contains(feature02);
});

test('When different features are loaded, only new features should trigger an API call', async (t: TestController) => {
    await t.wait(300);

    await t.click(CLEAR_STORAGE_BUTTON);

    const requestBody1Json = JSON.stringify({
        features: [feature01],
        entityId: 'user01'
    });
    const requestBody2Json = JSON.stringify({
        features: [feature02],
        entityId: 'user01'
    });

    // Load feature 1, make API call

    await t
        .typeText(PAYLOAD, requestBody1Json, { replace: true })
        .click(INITIALIZE_BUTTON);

    await t.wait(300);

    await t
        .expect(REQUEST_BODY.textContent)
        .contains(feature01)
        .expect(RESPONSE_STATUS.textContent)
        .eql(STATUS_200.toString());

    // Load feature 2, make API call

    await t
        .typeText(PAYLOAD, requestBody2Json, { replace: true })
        .click(INITIALIZE_BUTTON);

    await t.wait(300);

    await t
        .expect(REQUEST_BODY.textContent)
        .contains(feature02)
        .expect(RESPONSE_STATUS.textContent)
        .eql(STATUS_200.toString());

    // Load feature 1, no API call since already cached

    await t
        .typeText(PAYLOAD, requestBody1Json, { replace: true })
        .click(INITIALIZE_BUTTON);

    await t.wait(300);

    await t.expect(REQUEST_BODY.textContent).notContains(feature01);
});

test('When calling evaluateFeature with an unloaded feature, an error is seen', async (t: TestController) => {
    await t.wait(300);

    await t
        .typeText(FEATURE_NAME, feature01, { replace: true })
        .click(EVALUATE_BUTTON);

    await t.wait(300);

    await t
        .expect(EVALUATE_ERROR.textContent)
        .contains(feature01)
        .expect(EVALUATE_RESPONSE.textContent)
        .eql(UNDEFINED);
});

test('When calling evaluateFeature with a feature not last loaded, an error is seen', async (t: TestController) => {
    await t.wait(300);

    await t.click(CLEAR_STORAGE_BUTTON);

    const requestBody1Json = JSON.stringify({
        features: [feature01],
        entityId: 'user01'
    });
    const requestBody2Json = JSON.stringify({
        features: [feature02],
        entityId: 'user01'
    });

    // Load feature 1

    await t
        .typeText(PAYLOAD, requestBody1Json, { replace: true })
        .click(INITIALIZE_BUTTON);

    await t.wait(300);

    await t
        .expect(REQUEST_BODY.textContent)
        .contains(feature01)
        .expect(RESPONSE_STATUS.textContent)
        .eql(STATUS_200.toString());

    // Check feature 1, no error

    await t
        .typeText(FEATURE_NAME, feature01, { replace: true })
        .click(EVALUATE_BUTTON);

    await t.wait(300);

    await t
        .expect(EVALUATE_ERROR.textContent)
        .eql(UNDEFINED)
        .expect(EVALUATE_RESPONSE.textContent)
        .contains(feature01);

    // Load feature 2

    await t
        .typeText(PAYLOAD, requestBody2Json, { replace: true })
        .click(INITIALIZE_BUTTON);

    await t.wait(300);

    await t
        .expect(REQUEST_BODY.textContent)
        .contains(feature02)
        .expect(RESPONSE_STATUS.textContent)
        .eql(STATUS_200.toString());

    // Check feature 1, error

    await t
        .typeText(FEATURE_NAME, feature01, { replace: true })
        .click(EVALUATE_BUTTON);

    await t.wait(300);

    await t
        .expect(EVALUATE_ERROR.textContent)
        .contains(feature01)
        .expect(EVALUATE_RESPONSE.textContent)
        .eql(UNDEFINED);
});
