import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createContact, listContacts } from '@/lib/crm';

const createContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  company: z.string().optional(),
  whatsappOptIn: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const contacts = await listContacts();

  const payload = contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    company: contact.company,
    whatsappOptIn: contact.whatsappOptIn,
    tags: contact.tags ? safeParseArray(contact.tags) : [],
    notes: contact.notes,
    createdAt: contact.createdAt.toISOString(),
    voiceProfileId: contact.voiceProfile?.id ?? null,
    voiceModelVersion: contact.voiceProfile?.modelVersion ?? null,
  }));

  return NextResponse.json({ contacts: payload });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createContactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const contact = await createContact(parsed.data);
    const payload = {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      company: contact.company,
      whatsappOptIn: contact.whatsappOptIn,
      tags: contact.tags ? safeParseArray(contact.tags) : [],
      notes: contact.notes,
      createdAt: contact.createdAt.toISOString(),
      voiceProfileId: null,
      voiceModelVersion: null,
    };
    return NextResponse.json({ contact: payload }, { status: 201 });
  } catch (error) {
    console.error('Failed to create contact', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}

function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string');
    }
    return [];
  } catch {
    return [];
  }
}
