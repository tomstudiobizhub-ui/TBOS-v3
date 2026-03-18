// pb_hooks/jobs.auto-delete.js

onModelAfterUpdate((e) => {
    // Check if status changed to Completed
    if (e.model.get('status') === 'Completed' && e.model.get('status') !== e.oldModel.get('status')) {
        
        const files = e.model.get('job_files');
        
        if (files && files.length > 0) {
            console.log(`🗑️ Job ${e.model.get('tracking_id')} completed. Deleting ${files.length} files...`);
            
            files.forEach((filename) => {
                try {
                    e.app.deleteFile(`jobs/${e.model.id}/${filename}`);
                    console.log(`✅ Deleted: ${filename}`);
                } catch (err) {
                    console.error(`❌ Failed to delete ${filename}:`, err);
                }
            });
            
            // Clear the file field
            e.model.set('job_files', []);
            e.app.save(e.model);
        }
    }
}, 'jobs');