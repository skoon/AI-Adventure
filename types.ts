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
  CYBERPUNK = 'Cyberpunk',
  STEAMPUNK = 'Steampunk',
  SPY = 'Spy Adventure'
}

export interface StorySegment {
  id: number;
  type: 'narrative' | 'action' | 'system';
  text: string;
  imageUrl?: string;
  isImageLoading?: boolean;
}

export type ChatSession = Chat;
export type ChatHistory = Content[];

export interface Stat {
  current: number;
  max: number;
}

export interface PlayerStats {
  health: Stat;
  mana: Stat;
  stamina: Stat;
}

export interface Enemy {
  name: string;
  health: Stat;
}

export interface SavedGame {
  storyHistory: StorySegment[];
  chatHistory: ChatHistory;
  inventory: string[];
  playerStats: PlayerStats;
  isInCombat: boolean;
  currentEnemy: Enemy | null;
}