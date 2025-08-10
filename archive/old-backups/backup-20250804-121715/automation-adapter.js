// Save this as automation-adapter.js
// This adapts the automation's data to work with our comprehensive schema

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class CameraAdapter {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath || path.join(__dirname, 'data', 'camera-vault.db'));
    }

    // Convert automation camera data to our schema
    adaptCameraData(cameraData) {
        // Generate a clean slug
        const slug = `${cameraData.brand}-${cameraData.model}`
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        return {
            // Basic Information
            brand: cameraData.brand,
            model: cameraData.model,
            fullName: cameraData.fullName || `${cameraData.brand} ${cameraData.model}`,
            slug: slug,
            category: cameraData.category,
            releaseYear: cameraData.releaseYear,
            discontinued: cameraData.discontinued ? 1 : 0,
            
            // Sensor Specifications
            sensorSize: cameraData.sensor?.size || cameraData.sensorSize,
            sensorType: cameraData.sensor?.type || cameraData.sensorType,
            sensorMegapixels: cameraData.sensor?.megapixels || cameraData.sensorMegapixels,
            sensorNotes: cameraData.sensor?.notes || cameraData.sensorNotes,
            
            // ISO Performance
            isoMin: cameraData.iso?.min || cameraData.isoMin,
            isoMax: cameraData.iso?.max || cameraData.isoMax,
            
            // Shutter
            shutterSpeedMin: cameraData.shutter?.min || cameraData.shutterSpeedMin,
            shutterSpeedMax: cameraData.shutter?.max || cameraData.shutterSpeedMax,
            
            // Continuous Shooting
            continuousShooting: cameraData.continuousShooting,
            
            // Video Specifications
            videoMaxResolution: cameraData.video?.maxResolution || cameraData.videoMaxResolution,
            videoMaxFrameRate: cameraData.video?.maxFrameRate || cameraData.videoMaxFrameRate,
            videoFormats: cameraData.video?.formats || cameraData.videoFormats,
            video4K: cameraData.video?.maxResolution?.includes('4K') ? 1 : 0,
            video8K: cameraData.video?.maxResolution?.includes('8K') ? 1 : 0,
            
            // Video Features
            hdmi: cameraData.video?.hdmi || cameraData.hdmi ? 1 : 0,
            headphoneJack: cameraData.video?.headphoneJack || cameraData.headphoneJack ? 1 : 0,
            microphoneJack: cameraData.video?.microphoneJack || cameraData.microphoneJack ? 1 : 0,
            
            // Connectivity
            wireless: cameraData.connectivity?.wireless || cameraData.wireless,
            gps: cameraData.connectivity?.gps || cameraData.gps ? 1 : 0,
            
            // Battery & Power
            batteryLife: cameraData.battery?.life || cameraData.batteryLife,
            batteryType: cameraData.battery?.type || cameraData.batteryType,
            
            // Build & Design
            weatherSealed: cameraData.build?.weatherSealed || cameraData.weatherSealed ? 1 : 0,
            weight: cameraData.build?.weight || cameraData.weight,
            dimensionsWidth: cameraData.build?.dimensions?.width || cameraData.dimensionsWidth,
            dimensionsHeight: cameraData.build?.dimensions?.height || cameraData.dimensionsHeight,
            dimensionsDepth: cameraData.build?.dimensions?.depth || cameraData.dimensionsDepth,
            
            // Pricing
            msrp: cameraData.price,
            currentPrice: cameraData.price,
            
            // Stabilization
            ibis: cameraData.features?.ibis || cameraData.ibis ? 1 : 0,
            
            // Lens System
            lensMount: cameraData.features?.mount || cameraData.lensMount,
            
            // Flash
            builtInFlash: cameraData.features?.builtInFlash || cameraData.builtInFlash ? 1 : 0,
            hotShoe: cameraData.features?.hotShoe || cameraData.hotShoe ? 1 : 0,
            
            // Viewfinder
            viewfinderType: cameraData.viewfinder?.type || cameraData.viewfinderType,
            viewfinderCoverage: cameraData.viewfinder?.coverage || cameraData.viewfinderCoverage,
            viewfinderMagnification: cameraData.viewfinder?.magnification || cameraData.viewfinderMagnification,
            
            // Storage
            dualCardSlots: cameraData.storage?.dualSlots || cameraData.dualCardSlots ? 1 : 0,
            cardSlot1Type: cameraData.storage?.slot1 || cameraData.cardSlot1Type,
            cardSlot2Type: cameraData.storage?.slot2 || cameraData.cardSlot2Type,
            
            // Images
            imageUrl: cameraData.image?.url || cameraData.imageUrl,
            imageId: cameraData.image?.id || cameraData.imageId,
            thumbUrl: cameraData.image?.thumb || cameraData.thumbUrl,
            imageAttribution: cameraData.image?.attribution || cameraData.imageAttribution,
            
            // Resources
            manualUrl: cameraData.manualUrl,
            
            // Additional connectivity info
            connectivity: cameraData.connectivity?.other || cameraData.connectivity
        };
    }

    // Save camera with adapted data
    saveCamera(cameraData) {
        return new Promise((resolve, reject) => {
            const adapted = this.adaptCameraData(cameraData);
            
            // Build dynamic SQL based on provided fields
            const fields = Object.keys(adapted).filter(key => adapted[key] !== undefined);
            const placeholders = fields.map(() => '?').join(', ');
            const values = fields.map(field => adapted[field]);
            
            const sql = `INSERT OR REPLACE INTO cameras (${fields.join(', ')}) VALUES (${placeholders})`;
            
            this.db.run(sql, values, function(err) {
                if (err) {
                    console.error('❌ Error saving camera:', err);
                    reject(err);
                } else {
                    console.log(`✅ Saved ${adapted.brand} ${adapted.model} (ID: ${this.lastID})`);
                    resolve(this.lastID);
                }
            });
        });
    }

    // Save image attribution
    saveAttribution(cameraId, attribution) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO image_attributions 
                (camera_id, image_url, source_name, source_url, photographer, license) 
                VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                cameraId,
                attribution.imageUrl,
                attribution.sourceName,
                attribution.sourceUrl,
                attribution.photographer,
                attribution.license
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    close() {
        this.db.close();
    }
}

// Export for use in automation
module.exports = CameraAdapter;

// If run directly, test with sample data
if (require.main === module) {
    console.log('🧪 Testing Camera Adapter...\n');
    
    const adapter = new CameraAdapter();
    
    // Test data similar to what automation provides
    const testCamera = {
        brand: 'Sony',
        model: 'A7R V',
        category: 'mirrorless',
        releaseYear: 2022,
        sensor: {
            size: 'Full Frame',
            type: 'BSI-CMOS',
            megapixels: 61
        },
        video: {
            maxResolution: '8K',
            maxFrameRate: 24
        },
        price: 3898,
        features: {
            ibis: true,
            mount: 'Sony E'
        }
    };
    
    adapter.saveCamera(testCamera)
        .then(id => {
            console.log(`✅ Test successful! Camera saved with ID: ${id}`);
            adapter.close();
        })
        .catch(err => {
            console.error('❌ Test failed:', err);
            adapter.close();
        });
}