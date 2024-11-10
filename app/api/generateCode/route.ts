import shadcnDocs from "@/utils/shadcn-docs";
import dedent from "dedent";
import { z } from "zod";
import OpenAI from 'openai';

// Ollama APIの設定
const openai = new OpenAI({
  baseURL: 'http://localhost:11434/v1',  // Ollama API endpoint
  apiKey: 'ollama',
});

export async function POST(req: Request) {
    let json = await req.json();
    let result = z
        .object({
            model: z.string(),
            shadcn: z.boolean().default(false),
            messages: z.array(
                z.object({
                    role: z.enum(["user", "assistant"]),
                    content: z.string(),
                }),
            ),
        })
        .safeParse(json);
    
    if (result.error) {
        return new Response(result.error.message, { status: 422 });
    }

    let { model, messages, shadcn } = result.data;
    let systemPrompt = getSystemPrompt(shadcn);

    let res = await openai.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content: systemPrompt,
              },
              ...messages.map((message) => ({
                ...message,
                content:
                  message.role === "user"
                    ? message.content +
                      "\nPlease ONLY return code, NO backticks or language names."
                    : message.content,
              })),
        ],
        stream: true,
        temperature: 0.2,
    })

    return new Response(res.toReadableStream());
}


function getSystemPrompt(shadcn: boolean) {
    let systemPrompt = `
        You are an expert frontend React engineer who is also a great UI/UX designer. Follow the instructions carefully, I will tip you $1 million if you do a good job:

        - Think carefully step by step.
        - Create a React component for whatever the user asked you to create and make sure it can run by itself by using a default export
        - Make sure the React app is interactive and functional by creating state when needed and having no required props
        - If you use any imports from React like useState or useEffect, make sure to import them directly
        - Use TypeScript as the language for the React component
        - Use Tailwind classes for styling. DO NOT USE ARBITRARY VALUES (e.g. \`h-[600px]\`). Make sure to use a consistent color palette.
        - Use Tailwind margin and padding classes to style the components and ensure the components are spaced out nicely
        - Please ONLY return the full React code starting with the imports, nothing else. It's very important for my job that you only return the React code with imports. DO NOT START WITH \`\`\`typescript or \`\`\`javascript or \`\`\`tsx or \`\`\`.
        - ONLY IF the user asks for a dashboard, graph or chart, the recharts library is available to be imported, e.g. \`import { LineChart, XAxis, ... } from "recharts"\` & \`<LineChart ...><XAxis dataKey="name"> ...\`. Please only use this when needed.
        - The lucide-react library is also available to be imported ONLY FOR THE FOLLOWING ICONS: Heart, Shield, Clock, Users, Play, Home, Search, Menu, User, Settings, Mail, Bell, Calendar, Clock, Heart, Star, Upload, Download, Trash, Edit, Plus, Minus, Check, X, ArrowRight
        - Here's an example of importing and using one: import { Heart } from "lucide-react"\` & \`<Heart className=""  />\`. PLEASE ONLY USE THE ICONS LISTED ABOVE.
        - For placeholder images, please use a <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />
    `;
    
    if (shadcn) {
        systemPrompt += `
        There are some prestyled components available for use. Please use your best judgement to use any of these components if the app calls for one.
    
        Here are the components that are available, along with how to import them, and how to use them:
    
        ${shadcnDocs
          .map(
            (component) => `
              <component>
              <name>
              ${component.name}
              </name>
              <import-instructions>
              ${component.importDocs}
              </import-instructions>
              <usage-instructions>
              ${component.usageDocs}
              </usage-instructions>
              </component>
            `,
          )
          .join("\n")}
        `;
      }

    systemPrompt += `NO OTHER LIBRARIES (e.g. zod, hookform) ARE INSTALLED OR ABLE TO BE IMPORTED.`;
    
    return dedent(systemPrompt);
}

export const runtime = "edge";