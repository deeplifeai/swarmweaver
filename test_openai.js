import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables from .env file
dotenv.config();

async function testOpenAI() {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('Testing OpenAI API connection...');
    
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: 'Hello, are you working?' }],
      model: 'gpt-4o',
    });

    console.log('✅ OpenAI API connection successful!');
    console.log('Response:', completion.choices[0].message.content);
    
  } catch (error) {
    console.error('❌ Error connecting to OpenAI API:');
    console.error(error.message);
    process.exit(1);
  }
}

testOpenAI(); 