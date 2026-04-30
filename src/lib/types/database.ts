export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          location_lat: number | null;
          location_lng: number | null;
          weather_zip: string | null;
          invite_token: string | null;
          invite_expires_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          weather_zip?: string | null;
          invite_token?: string | null;
          invite_expires_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          weather_zip?: string | null;
          invite_token?: string | null;
          invite_expires_at?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          household_id: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          household_id?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type Household = Database["public"]["Tables"]["households"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
