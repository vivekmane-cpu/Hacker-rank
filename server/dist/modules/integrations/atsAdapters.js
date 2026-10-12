"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeverAdapter = exports.GreenhouseAdapter = void 0;
// 1. Greenhouse ATS Adapter
exports.GreenhouseAdapter = {
    name: 'greenhouse',
    parseInboundWebhook(headers, body) {
        const action = body.action || 'ping';
        const app = body.payload?.application;
        if (!app && action === 'ping') {
            return {
                ats: 'greenhouse',
                action: 'ping',
                candidateEmail: '',
                candidateName: '',
                externalApplicationId: 'ping'
            };
        }
        if (!app || !app.candidate) {
            throw new Error('Invalid Greenhouse webhook: missing application or candidate payload');
        }
        const first = app.candidate.first_name || '';
        const last = app.candidate.last_name || '';
        return {
            ats: 'greenhouse',
            action,
            candidateEmail: (app.candidate.email || '').toLowerCase().trim(),
            candidateName: `${first} ${last}`.trim(),
            externalApplicationId: String(app.id),
            stageName: app.current_stage?.name
        };
    },
    formatOutboundResult(candidateData, result) {
        const recommendation = result.passed ? 'definitely_yes' : 'definitely_no';
        return {
            ats: 'greenhouse',
            externalId: candidateData.applicationId,
            payload: {
                application_id: candidateData.applicationId,
                overall_recommendation: recommendation,
                ratings: [
                    {
                        attribute_name: 'Technical Competency',
                        rating: result.passed ? 'strong_yes' : 'no',
                        notes: `Score: ${result.score.toFixed(1)}% (Pass Threshold: ${result.passScore}%). Full Evaluation Report: ${result.reportUrl || 'N/A'}`
                    }
                ]
            }
        };
    }
};
// 2. Lever ATS Adapter
exports.LeverAdapter = {
    name: 'lever',
    parseInboundWebhook(headers, body) {
        const event = body.event || 'candidate_stage_change';
        const data = body.data;
        if (!data && event === 'ping') {
            return {
                ats: 'lever',
                action: 'ping',
                candidateEmail: '',
                candidateName: '',
                externalApplicationId: 'ping'
            };
        }
        if (!data || !data.contact) {
            throw new Error('Invalid Lever webhook: missing data or contact details');
        }
        return {
            ats: 'lever',
            action: event,
            candidateEmail: (data.contact.email || '').toLowerCase().trim(),
            candidateName: data.contact.name || '',
            externalApplicationId: String(data.opportunityId || data.candidateId),
            stageName: data.stage
        };
    },
    formatOutboundResult(candidateData, result) {
        return {
            ats: 'lever',
            externalId: candidateData.opportunityId,
            payload: {
                opportunity_id: candidateData.opportunityId,
                text: `**Kombee Assess Technical Evaluation**\n- Candidate: ${candidateData.candidateName}\n- Score: ${result.score.toFixed(1)}%\n- Outcome: ${result.passed ? 'PASSED' : 'DID NOT PASS'}\n- Full Report: ${result.reportUrl || 'N/A'}`,
                fields: {
                    assessment_score: result.score,
                    assessment_passed: result.passed
                }
            }
        };
    }
};
