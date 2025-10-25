import { useState } from 'react';
import { Button, Input, Label } from '@/components/ui';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fi } from 'zod/locales';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long').max(100, 'Name must be at most 100 characters long'),
});

const SignupForm = () => {

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(signupSchema),
  });

  return (
    <>
    <form onSubmit = {handleSubmit(() => {})}>
      <div>
        <label htmlFor="email">Email</label>
        <Controller 
          name = 'email'
          control = {control}
          render = {
            ({ field }) =>(
              <Input {...field} id="email" type="email" placeholder="Enter your email" />
            )
          }
          />
        {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
      </div>
    </form>
    
    </>

  )


};