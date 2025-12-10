import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteContact, updateContact } from '@/lib/crm';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  whatsappOptIn: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      calls: {
        orderBy: { startedAt: 'desc' },
        include: { transcript: true },
      },
      voiceProfile: true,
    },
  });

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }

  return NextResponse.json({ contact });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const contact = await updateContact(id, parsed.data);
    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Failed to update contact', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteContact(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete contact', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
