"use client";
import { useParams } from "next/navigation";
import { EventEditor } from "@/components/events/EventEditor";
export default function EditEventPage(){ const params=useParams<{id:string}>(); return <EventEditor eventId={params.id}/>; }
