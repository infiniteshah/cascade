import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MealsPage() {
  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-6 text-2xl font-bold">Meal Planning</h2>
        <Card>
          <CardHeader>
            <CardTitle>Coming in Phase 9</CardTitle>
            <CardDescription>
              Weekly meal plans with smart grocery lists
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
              <div className="mb-4 text-4xl">🍽️</div>
              <p className="text-sm">Meal planning will be available soon</p>
              <p className="mt-1 text-xs text-zinc-400">
                Get Sunday meal plan suggestions based on your cooking history
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
