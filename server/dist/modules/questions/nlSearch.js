"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNaturalLanguageQuery = parseNaturalLanguageQuery;
exports.generateQuestionSummary = generateQuestionSummary;
function parseNaturalLanguageQuery(query) {
    const normalized = query.toLowerCase().trim();
    const filters = {};
    // 1. Difficulty extraction
    if (normalized.includes('easy'))
        filters.difficulty = 'easy';
    else if (normalized.includes('medium'))
        filters.difficulty = 'medium';
    else if (normalized.includes('hard'))
        filters.difficulty = 'hard';
    else if (normalized.includes('expert'))
        filters.difficulty = 'expert';
    // 2. Question type extraction
    if (normalized.includes('coding') || normalized.includes('algorithm') || normalized.includes('code')) {
        filters.type = 'coding';
    }
    else if (normalized.includes('sql') || normalized.includes('database')) {
        filters.type = 'database_sql';
    }
    else if (normalized.includes('multiple choice') || normalized.includes('mcq')) {
        filters.type = 'multiple_choice';
    }
    else if (normalized.includes('essay') || normalized.includes('subjective')) {
        filters.type = 'subjective';
    }
    else if (normalized.includes('repository') || normalized.includes('project')) {
        filters.type = 'code_repository';
    }
    else if (normalized.includes('whiteboard') || normalized.includes('diagram')) {
        filters.type = 'whiteboard';
    }
    // 3. Extract remainder as substantive keyword search
    let cleaned = normalized
        .replace(/\b(find|me|a|an|question|questions|about|test|exam|with|difficulty)\b/g, '')
        .replace(/\b(easy|medium|hard|expert)\b/g, '')
        .replace(/\b(coding|mcq|sql|database|subjective|whiteboard)\b/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    if (cleaned.length > 0) {
        filters.keywordQuery = cleaned;
    }
    return filters;
}
function generateQuestionSummary(title, description, type, difficulty) {
    const cleanDesc = description.replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').trim();
    const snippet = cleanDesc.length > 120 ? `${cleanDesc.substring(0, 117)}...` : cleanDesc;
    return `[${difficulty.toUpperCase()} ${type.replace('_', ' ').toUpperCase()}] ${title}: ${snippet}`;
}
