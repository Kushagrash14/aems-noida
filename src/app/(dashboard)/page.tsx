import { cookies } from 'next/headers';
import {
  getAssets,
  getPMComplaints,
  getDamageScrapReports,
  getLocations,
  getPlants,
  getDepartments,
  getCategories,
} from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { isEntityInUserScope } from '@/lib/permissions';
import DashboardClientView from '@/components/dashboard/DashboardClientView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardOverviewPage() {
  // Fetch all necessary master data concurrently once
  const [
    assets,
    complaints,
    damageReports,
    locations,
    plants,
    departments,
    categories,
  ] = await Promise.all([
    getAssets(),
    getPMComplaints(),
    getDamageScrapReports(),
    getLocations(),
    getPlants(),
    getDepartments(),
    getCategories(),
  ]);

  // Read authenticated session and apply department / plant / location scope
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(sessionToken);

  let scopedAssets = assets;
  let scopedDamageReports = damageReports;
  let scopedComplaints = complaints;
  let scopedLocations = locations;
  let scopedPlants = plants;
  let scopedDepartments = departments;

  if (validation.valid && validation.user && validation.user.role !== 'it_admin') {
    const user = validation.user;
    const scope = validation.scope;

    scopedAssets = assets.filter((a) =>
      isEntityInUserScope(user, scope || null, {
        category_id: a.category_id,
        location_id: a.current_location_id,
        plant_id: a.current_plant_id,
        department_id: a.current_department_id,
      })
    );
    scopedDamageReports = damageReports.filter((d) => {
      if (!d.asset) return true;
      return isEntityInUserScope(user, scope || null, {
        category_id: d.asset.category_id,
        location_id: d.asset.current_location_id,
        plant_id: d.asset.current_plant_id,
        department_id: d.asset.current_department_id,
      });
    });
    scopedComplaints = complaints.filter((c) => {
      if (!c.machine) return true;
      return isEntityInUserScope(user, scope || null, {
        location_id: c.machine.location_id,
        plant_id: c.machine.plant_id,
        department_id: c.machine.department_id,
      });
    });
    const userLocId = user.location_id || scope?.location_ids?.[0];
    const userPltId = user.plant_id || scope?.plant_ids?.[0];
    const userDeptId = user.department_id || scope?.department_ids?.[0];

    if (scope?.location_ids && scope.location_ids.length > 0) {
      scopedLocations = locations.filter((l) => scope.location_ids!.includes(l.id));
    } else if (userLocId) {
      scopedLocations = locations.filter((l) => l.id === userLocId);
    }

    if (scope?.plant_ids && scope.plant_ids.length > 0) {
      scopedPlants = plants.filter((p) => scope.plant_ids!.includes(p.id));
    } else if (userPltId) {
      scopedPlants = plants.filter((p) => p.id === userPltId);
    }

    if (scope?.department_ids && scope.department_ids.length > 0) {
      scopedDepartments = departments.filter((d) => scope.department_ids!.includes(d.id));
    } else if (userDeptId) {
      scopedDepartments = departments.filter((d) => d.id === userDeptId);
    }
  }

  return (
    <DashboardClientView
      initialAssets={scopedAssets}
      complaints={scopedComplaints}
      damageReports={scopedDamageReports}
      locations={scopedLocations}
      plants={scopedPlants}
      departments={scopedDepartments}
      categories={categories}
      user={validation.user || null}
      scope={validation.scope || null}
    />
  );
}

