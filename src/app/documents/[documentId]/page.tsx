import { Document } from "./document";

interface DocumentIdPageProps {
  params: Promise<{ documentId: string }>;
}

const DocumentIdPage = async ({ params }: DocumentIdPageProps) => {
  const { documentId } = await params;
  const id = parseInt(documentId);

  if (isNaN(id)) {
    throw new Error("Invalid document ID");
  }

  return <Document documentId={id} />;
};

export default DocumentIdPage;
