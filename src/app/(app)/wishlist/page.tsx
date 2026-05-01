import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WishlistPage() {
  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-6 text-2xl font-bold">Wishlist</h2>
        <Card>
          <CardHeader>
            <CardTitle>Coming in Phase 8</CardTitle>
            <CardDescription>
              Track things you want to do "someday" and get nudged when you have free time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
              <div className="mb-4 text-4xl">⭐</div>
              <p className="text-sm">Wishlist will be available soon</p>
              <p className="mt-1 text-xs text-zinc-400">
                Add items like "Find a new microwave" and get smart suggestions on weekends
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
