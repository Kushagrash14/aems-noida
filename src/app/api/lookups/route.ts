import { NextRequest, NextResponse } from 'next/server';
import { getLocations, getPlants, getDepartments, getCategories } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 });
  }

  try {
    let [locations, plants, departments, categories] = await Promise.all([
      getLocations(),
      getPlants(),
      getDepartments(),
      getCategories(),
    ]);

    const currentUser = validation.user;
    if (currentUser.role !== 'it_admin') {
      // Scope locations
      if (currentUser.location_id) {
        locations = locations.filter((l) => l.id === currentUser.location_id);
      } else if (validation.scope?.location_ids && validation.scope.location_ids.length > 0) {
        locations = locations.filter((l) => validation.scope!.location_ids!.includes(l.id));
      }

      // Scope plants
      if (currentUser.plant_id) {
        plants = plants.filter((p) => p.id === currentUser.plant_id);
      } else if (validation.scope?.plant_ids && validation.scope.plant_ids.length > 0) {
        plants = plants.filter((p) => validation.scope!.plant_ids!.includes(p.id));
      } else if (currentUser.location_id) {
        plants = plants.filter((p) => p.location_id === currentUser.location_id);
      }

      // Scope departments
      if (currentUser.department_id) {
        departments = departments.filter((d) => d.id === currentUser.department_id);
      } else if (validation.scope?.department_ids && validation.scope.department_ids.length > 0) {
        departments = departments.filter((d) => validation.scope!.department_ids!.includes(d.id));
      } else if (currentUser.plant_id) {
        departments = departments.filter((d) => !d.plant_id || d.plant_id === currentUser.plant_id);
      }
    }

    return NextResponse.json({
      locations,
      plants,
      departments,
      categories,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch lookups';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
