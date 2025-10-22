import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});


export async function POST(request: NextRequest){
    try{

        // Parse and validate the request body
        const body = await request.json();

        
        const {email, password} = loginSchema.parse(body);

    }
    catch(error){
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  
    }
}