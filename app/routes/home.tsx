import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "GitHub Contributions Viewer" },
    { name: "description", content: "Visualize and customize your GitHub contribution graph." },
  ];
}

export default function Home() {
  return <Welcome />;
}
