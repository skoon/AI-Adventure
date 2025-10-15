import type { Chat, Content } from "@google/genai";

export enum GameState {
  START_SCREEN = 'START_SCREEN',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}

export enum AdventureGenre {
  FANTASY = 'Fantasy',
  SCIFI = 'Sci-Fi',
  MYSTERY = 'Mystery',
  CYBERPUNK = 'Cyberpunk'
}

export interface StorySegment {
  id: number;
  type: 'narrative' | 'action' | 'system';
  text: string;
}

export type ChatSession = Chat;
export type ChatHistory = Content[];

export interface SavedGame {
  storyHistory: StorySegment[];
  chatHistory: ChatHistory;
  inventory: string[];
}
