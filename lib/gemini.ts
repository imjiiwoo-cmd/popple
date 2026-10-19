import { GoogleGenAI } from '@google/genai';

/**
 * Google Gen AI SDK 클라이언트 인스턴스
 * process.env.GEMINI_API_KEY 환경변수를 기본으로 사용합니다.
 */
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});
