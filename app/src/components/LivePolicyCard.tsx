import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { ADDR, addrUrl } from "../config";
import { policyManagerAbi } from "../abi/PolicyManager";

/**
 * Renders the image that PolicyManager.tokenURI() builds on-chain for a real policy.
 * The SVG is produced by our own verified contract and displayed through <img>, which never
 * executes scripts; the data URL prefix is checked before use.
 */
export function LivePolicyCard({ policyId }: { policyId: bigint }) {
  const uri = useReadContract({
    address: ADDR.policyManager,
    abi: policyManagerAbi,
    functionName: "tokenURI",
    args: [policyId],
  });

  const { image, description } = useMemo(() => {
    const raw = uri.data;
    const prefix = "data:application/json;base64,";
    if (!raw || !raw.startsWith(prefix)) return { image: undefined, description: undefined };
    try {
      const json = JSON.parse(atob(raw.slice(prefix.length))) as { image?: string; name?: string; description?: string };
      const ok = json.image?.startsWith("data:image/svg+xml;base64,");
      const text = [json.name, json.description].filter((v): v is string => typeof v === "string" && v.length > 0).join(". ");
      return { image: ok ? json.image : undefined, description: text || undefined };
    } catch {
      return { image: undefined, description: undefined };
    }
  }, [uri.data]);

  return (
    <figure className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-amber/10 blur-3xl" aria-hidden />
      <div className="rotate-[-3deg] overflow-hidden rounded-[18px] border border-line shadow-2xl shadow-black/60 transition-transform duration-500 hover:rotate-0">
        {image ? (
          <img src={image} alt={description ?? `BACKSTOP policy #${policyId}, rendered on-chain`} width={400} height={240} className="block w-full" />
        ) : (
          <div role="img" aria-label="Loading the on-chain policy card" className="aspect-[5/3] w-full animate-pulse bg-panel-2" />
        )}
      </div>
      <figcaption className="mt-4 text-xs text-dim">
        Policy #{policyId.toString()}, drawn by{" "}
        <a className="underline hover:text-amber" href={addrUrl(ADDR.policyManager)} target="_blank" rel="noopener noreferrer">
          PolicyManager.tokenURI()
        </a>{" "}
        on Mezo testnet. Non-transferable.
      </figcaption>
    </figure>
  );
}
