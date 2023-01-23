import { isValidInitalizeFeaturesRequest } from '../types';

describe('evidently types test', () => {
    test('when request type is valid then isValidInitalizeFeaturesRequest returns true', async () => {
        const request = {
            features: ['one'],
            entityId: 'hello',
            context: '{}'
        };
        const result = isValidInitalizeFeaturesRequest(request);
        expect(result).toBeTruthy();
    });

    test('when request doesnt include optional parameters then isValidInitalizeFeaturesRequest returns true', async () => {
        const request1 = {
            features: ['one'],
            entityId: 'hello'
        };
        const result1 = isValidInitalizeFeaturesRequest(request1);
        expect(result1).toBeTruthy();

        const request2 = {
            features: ['one'],
            context: '{}'
        };
        const result2 = isValidInitalizeFeaturesRequest(request2);
        expect(result2).toBeTruthy();

        const request3 = {
            features: ['one']
        };
        const result3 = isValidInitalizeFeaturesRequest(request3);
        expect(result3).toBeTruthy();
    });

    test('when optional parameters are wrong type then isValidInitalizeFeaturesRequest returns false', async () => {
        const request1 = {
            features: ['one'],
            entityId: 1
        };
        const result1 = isValidInitalizeFeaturesRequest(request1);
        expect(result1).toBeFalsy();

        const request2 = {
            features: ['one'],
            context: 1
        };
        const result2 = isValidInitalizeFeaturesRequest(request2);
        expect(result2).toBeFalsy();
    });

    test('when features is wrong type then isValidInitalizeFeaturesRequest returns false', async () => {
        const request1 = {
            features: 'feature'
        };
        const result1 = isValidInitalizeFeaturesRequest(request1);
        expect(result1).toBeFalsy();

        const request2 = {
            features: ['feature', 2, 'feature2']
        };
        const result2 = isValidInitalizeFeaturesRequest(request2);
        expect(result2).toBeFalsy();

        const request3 = {
            features: [['feature', [], 'feature2']]
        };
        const result3 = isValidInitalizeFeaturesRequest(request3);
        expect(result3).toBeFalsy();
    });
});
