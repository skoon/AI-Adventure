import { GoogleGenAI, Chat, Content } from "@google/genai";
import type { AdventureGenre, ChatSession, ChatHistory } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are a master storyteller and text adventure game engine. Your role is to create an immersive, dynamic, and interactive text-based adventure. Describe the world, the consequences of the player's actions, and present new challenges.
- Respond in the second person ('You see...', 'You feel...').
- Keep your responses descriptive but concise (1-2 paragraphs).
- Do not break character or mention that you are an AI.
- Your world contains items the player can pick up and drop.
- When the player successfully picks up an item, you MUST include a command in your response on a new line: \`[INVENTORY_ADD: item name]\`.
- When the player successfully drops an item, you MUST include a command in your response on a new line: \`[INVENTORY_REMOVE: item name]\`. The item name must EXACTLY match an item in their inventory.
- The player's current inventory will be provided with each prompt. Use this to inform the story. For example, if they have a key, they can open a corresponding lock. If they try to drop an item they don't have, tell them.
- Only respond with an inventory command if the action is successful. The narrative you provide should also describe the action, but the command is for the game engine.`;

export const startAdventure = async (genre: AdventureGenre): Promise<{ session: ChatSession; opening: string }> => {
  try {
    const chat: ChatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const initialPrompt = `Create an engaging and descriptive opening for a text adventure game in the ${genre} genre. Set a compelling scene and hint at an immediate objective or mystery. The opening scene should contain at least one item the player can choose to pick up.`;
    
    const response = await chat.sendMessage({ message: initialPrompt });
    
    return { session: chat, opening: response.text };
  } catch (error) {
    console.error("Error starting adventure:", error);
    throw new Error("Failed to start a new adventure with Gemini.");
  }
};

export const continueAdventure = async (session: ChatSession, action: string, inventory: string[]): Promise<string> => {
  try {
    const prompt = `Current Inventory: [${inventory.length > 0 ? inventory.join(', ') : 'empty'}]\n\nPlayer action: "${action}"`;
    const response = await session.sendMessage({ message: prompt });
    return response.text;
  } catch (error) {
    console.error("Error continuing adventure:", error);
    throw new Error("Failed to get the next part of the story from Gemini.");
  }
};

export const resumeAdventure = async (history: ChatHistory): Promise<ChatSession> => {
  try {
    const chat: ChatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      history,
    });
    return chat;
  } catch (error) {
    console.error("Error resuming adventure:", error);
    throw new Error("Failed to resume the adventure with Gemini.");
  }
};
