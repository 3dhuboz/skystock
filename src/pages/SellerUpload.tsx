import AdminUpload from './admin/AdminUpload';

/** Seller upload — reuses the admin upload form (AI Fill, auto-thumb, auto-preview,
 *  upload progress overlay) but posts through the /seller/* endpoints, which force
 *  seller_id + status='pending_review'. */
export default function SellerUpload() {
  return (
    <div className="min-h-screen bg-sky-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <AdminUpload sellerMode />
      </div>
    </div>
  );
}
