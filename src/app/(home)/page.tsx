"use client";

import { Navbar } from "./navbar";
import { TemplatesGallery } from "./templates-gallery";
import { DocumentsTable } from "./documents-table";
import { useSearchParam } from "@/hooks/use-search-param";
import { useDocuments } from "@/hooks/use-documents";

const Home = () => {
  const [search] = useSearchParam();
  const { results, status, loadMore, error } = useDocuments(search);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-10 h-16 bg-white p-4">
        <Navbar />
      </div>
      <div className="mt-16">
        <TemplatesGallery />
        {error && (
          <div className="max-w-screen-xl mx-auto px-16 py-6">
            <div className="text-red-500">Error loading documents: {error.message}</div>
          </div>
        )}
        <DocumentsTable documents={results} loadMore={loadMore} status={status} />
      </div>
    </div>
  );
};

export default Home;
