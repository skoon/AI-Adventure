import { GoogleGenAI, Chat, Content, Modality } from "@google/genai";
import type { AdventureGenre, ChatSession, ChatHistory, PlayerStats } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are a master storyteller and text adventure game engine. Your role is to create an immersive, dynamic, and interactive text-based adventure. Describe the world, the consequences of the player's actions, and present new challenges.
- Respond in the second person ('You see...', 'You feel...').
- Keep your responses descriptive but concise (1-2 paragraphs).
- Do not break character or mention that you are an AI.
- The player has stats: Health, Mana, and Stamina. These stats should affect the story. For example, low stamina might make actions fail, low health is dangerous, and mana is used for special abilities.
- Your world contains items the player can pick up and drop.
- The player may encounter enemies. To start a combat encounter, you MUST include a command on a new line: \`[COMBAT_START: name=Enemy Name, health=100]\`.
- During combat, describe the enemy's actions and the results of the player's actions.
- To end a combat encounter (e.g., enemy defeated, player flees), you MUST include a command on a new line: \`[COMBAT_END]\`.
- When an event or action should change a player's or enemy's stats, you MUST include a command in your response on a new line: \`[STAT_UPDATE: stat1=+value, stat2=-value]\`. For example: \`[STAT_UPDATE: health=-10, enemyHealth=-25]\`. Use 'health', 'mana', 'stamina', or 'enemyHealth'. The values can be positive or negative.
- When the player successfully picks up an item, you MUST include a command in your response on a new line: \`[INVENTORY_ADD: item name]\`.
- When the player successfully drops an item, you MUST include a command in your response on a new line: \`[INVENTORY_REMOVE: item name]\`. The item name must EXACTLY match an item in their inventory.
- After the narrative, on a new line, provide a concise, descriptive prompt for an image generation model that captures the essence of the scene. Format it as: \`[IMAGE_PROMPT: your descriptive prompt here]\`.
- The player's current inventory and stats will be provided with each prompt. Use this to inform the story.
- Only respond with a command if the action is successful. The narrative you provide should also describe the action, but the command is for the game engine.`;

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

export const continueAdventure = async (session: ChatSession, action: string, inventory: string[], stats: PlayerStats): Promise<string> => {
  try {
    const prompt = `Current Stats: Health(${stats.health.current}/${stats.health.max}), Mana(${stats.mana.current}/${stats.mana.max}), Stamina(${stats.stamina.current}/${stats.stamina.max})
Current Inventory: [${inventory.length > 0 ? inventory.join(', ') : 'empty'}]

Player action: "${action}"`;
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

export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image with Gemini.");
  }
};