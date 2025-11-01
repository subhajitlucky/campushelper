import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { limitSignup } from '@/lib/rateLimit';

const signupSchema = z.object(
    {
        email: z.string().email('Invalid email address'),
        password: z.string().min(6, 'Password must be at least 6 characters long'),
        name: z.string().min(2, 'Name must be at least 2 characters long').max(100, 'Name must be at most 100 characters long'),
    }
);

export async function POST(request: NextRequest){
    try{
        // Apply rate limiting: 5 signups per hour per IP
        await limitSignup(request);

        // Parse and validate the request body
        const body = await request.json();

        // Extract validated data
        const {email, password, name} = signupSchema.parse(body);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique(
            {
                where : {email},
            }
        );

        // If user exists, return error response
        if(existingUser){
            return NextResponse.json({error: 'User already exists'}, {status: 400});
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user in the database
        const newUser =  await prisma.user.create(
            {
                data : {
                    email,
                    name,
                    password: hashedPassword,
                }
            }
        );


        // Return success response
        return NextResponse.json(
            {
                message : 'User created successfully',
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                }
            },
            {status: 201}
        );

    }catch(error) {
        // Handle rate limiting errors
        if (error instanceof Error && error.message.includes('Too many requests')) {
            return NextResponse.json(
                { error: error.message },
                { status: 429 } // HTTP 429 = Too Many Requests
            );
        }

        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}