import { NextRequest, NextResponse } from 'next/server';
import { getMachineByQrToken } from '@/lib/store';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const machine = await getMachineByQrToken(token);

  if (!machine) {
    return NextResponse.json({ error: 'Invalid or expired QR code token' }, { status: 404 });
  }

  // Return public machine information for the floor worker
  return NextResponse.json({
    machine: {
      id: machine.id,
      machine_code: machine.machine_code,
      machine_name: machine.machine_name,
      plant_name: machine.plant?.name || 'Plant Floor',
      location_name: machine.location?.name || 'Factory',
      department_name: machine.department?.name || 'Operations',
      status: machine.status,
    },
  });
}
