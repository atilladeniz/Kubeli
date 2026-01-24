import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "What makes Kubeli different from Lens?",
    answer: "Kubeli is a native desktop app built with Tauri and Rust - not Electron like Lens. This means significantly lower memory usage (~100MB vs ~350MB), faster startup, and better OS integration. Plus: Kubeli is 100% open source and free."
  },
  {
    question: "Is Kubeli an Electron app?",
    answer: "No! Kubeli uses Tauri 2.0 with a Rust backend. This makes the app about 10x smaller than comparable Electron apps and much more resource-efficient. The native webview integration provides a true native experience on both macOS and Windows."
  },
  {
    question: "How does the AI assistant work?",
    answer: "Kubeli integrates with Claude Code CLI and OpenAI Codex CLI. You can analyze logs, get troubleshooting help, and request cluster insights in natural language. The AI runs locally - no cluster data is sent to the cloud."
  },
  {
    question: "Which Kubernetes versions are supported?",
    answer: "Kubeli supports all current Kubernetes versions through k8s-openapi v1.32. This includes local clusters (Minikube, kind, Docker Desktop) as well as cloud providers like GKE, EKS, and AKS."
  },
  {
    question: "Which platforms are supported?",
    answer: "Kubeli runs natively on macOS (10.15+) and Windows (10/11). Both platforms support auto-updates, so you'll always have the latest features and security fixes."
  },
  {
    question: "Is my cluster data secure?",
    answer: "Absolutely. Kubeli processes all data locally on your machine. There's no cloud connection, no telemetry, no data collection. Your kubeconfig stays on your device."
  }
]

export function FAQSection() {
  return (
    <Accordion type="single" collapsible className="w-full space-y-4">
      {faqs.map((faq, index) => (
        <AccordionItem
          key={index}
          value={`item-${index}`}
          className="bg-white rounded-xl border border-neutral-200 px-6"
        >
          <AccordionTrigger className="text-base font-medium hover:no-underline py-6">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-neutral-600 leading-relaxed pb-6">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
