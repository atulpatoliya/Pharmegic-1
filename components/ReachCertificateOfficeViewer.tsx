'use client';

type ReachCertificateOfficeViewerProps = {
  docxUrl: string;
};

/** Renders full Word layout via Microsoft Office Online when server PDF conversion is unavailable. */
export default function ReachCertificateOfficeViewer({ docxUrl }: ReachCertificateOfficeViewerProps) {
  const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(docxUrl)}`;

  return (
    <div className="relative min-h-[820px] bg-slate-100">
      <iframe
        title="EU REACH certificate preview"
        src={embedUrl}
        className="block w-full min-h-[820px] border-0 bg-white"
        allowFullScreen
      />
    </div>
  );
}
