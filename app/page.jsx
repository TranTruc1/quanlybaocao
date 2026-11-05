"use client";
import dynamic from "next/dynamic";
const Workspace=dynamic(()=>import("../src/main.jsx"),{ssr:false,loading:()=> <p style={{padding:32}}>Đang mở Sổ Liệu…</p>});
export default function Page(){return <Workspace/>;}
