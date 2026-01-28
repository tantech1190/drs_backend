const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const initialSpecialities = [
  { name: 'Primary Care', description: 'General medical care for all ages' },
  { name: 'Family Medicine', description: 'Comprehensive primary care for families' },
  { name: 'Internal Medicine', description: 'Adult internal medicine and chronic disease management' },
  { name: 'Cardiology', description: 'Heart and cardiovascular system specialists' },
  { name: 'Pediatrics', description: 'Medical care for infants, children, and adolescents' },
  { name: 'OB/GYN', description: 'Obstetrics and gynecology - women\'s health' },
  { name: 'Orthopedics', description: 'Musculoskeletal system and bone specialists' },
  { name: 'Dermatology', description: 'Skin, hair, and nail conditions' },
  { name: 'Neurology', description: 'Brain and nervous system disorders' },
  { name: 'General Surgery', description: 'Surgical procedures and operations' },
  { name: 'Psychiatry', description: 'Mental health and psychiatric disorders' },
  { name: 'ENT', description: 'Ear, nose, and throat specialists' },
  { name: 'Ophthalmology', description: 'Eye care and vision specialists' },
  { name: 'Urology', description: 'Urinary tract and male reproductive system' },
  { name: 'Gastroenterology', description: 'Digestive system specialists' },
  { name: 'Pulmonology', description: 'Respiratory system and lung specialists' },
  { name: 'Nephrology', description: 'Kidney disease specialists' },
  { name: 'Endocrinology', description: 'Hormones and metabolic disorders' },
  { name: 'Rheumatology', description: 'Autoimmune and musculoskeletal disorders' },
  { name: 'Oncology', description: 'Cancer diagnosis and treatment' },
  { name: 'Hematology', description: 'Blood disorders and diseases' },
  { name: 'Anesthesiology', description: 'Anesthesia and pain management' },
  { name: 'Emergency Medicine', description: 'Emergency and urgent care' },
  { name: 'Radiology', description: 'Medical imaging and diagnostics' },
  { name: 'Pathology', description: 'Laboratory medicine and diagnostics' },
  { name: 'Physical Medicine and Rehab', description: 'Rehabilitation and physical therapy' },
  { name: 'Infectious Disease', description: 'Infectious and communicable diseases' },
  { name: 'Allergy and Immunology', description: 'Allergies and immune system disorders' },
  { name: 'Plastic Surgery', description: 'Reconstructive and cosmetic surgery' },
  { name: 'Sports Medicine', description: 'Athletic injuries and performance' },
  { name: 'Pain Management', description: 'Chronic pain treatment and management' },
  { name: 'Geriatrics', description: 'Healthcare for elderly patients' },
  { name: 'Hospice and Palliative Care', description: 'End-of-life care and comfort' },
  { name: 'Sleep Medicine', description: 'Sleep disorders and treatment' },
  { name: 'Chiropractic', description: 'Spinal and musculoskeletal manipulation' },
  { name: 'Nurse Practitioner', description: 'Advanced practice nursing' },
  { name: 'Physician Assistant', description: 'Licensed medical professionals' },
  { name: 'Other', description: 'Other medical specialties' }
];

async function seedSpecialities() {
  let connection;
  
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/drs-club';
    console.log('🔌 Connecting to MongoDB...');
    
    connection = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('📦 Connected to MongoDB');
    console.log(`📍 Database: ${mongoURI}`);
    console.log('');
    
    // Import the model AFTER connection is established
    const Speciality = require('../models/Speciality');
    
    // Optional: Clear existing specialities (comment out if you want to preserve existing data)
    // const deleteCount = await Speciality.deleteMany({});
    // console.log(`🗑️  Cleared ${deleteCount.deletedCount} existing specialities`);
    // console.log('');
    
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    console.log('🌱 Starting to seed specialities...\n');
    
    for (const spec of initialSpecialities) {
      try {
        const existing = await Speciality.findOne({ name: spec.name });
        
        if (existing) {
          // Update existing
          await Speciality.findOneAndUpdate(
            { name: spec.name },
            { 
              description: spec.description,
              isActive: true  // Ensure it's active
            },
            { new: true }
          );
          console.log(`♻️  Updated: ${spec.name}`);
          updatedCount++;
        } else {
          // Create new
          await Speciality.create({
            ...spec,
            isActive: true,
            doctorCount: 0
          });
          console.log(`✅ Created: ${spec.name}`);
          createdCount++;
        }
      } catch (err) {
        console.error(`❌ Error with ${spec.name}:`, err.message);
        errorCount++;
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🎉 Seeding Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Created:  ${createdCount} specialities`);
    console.log(`♻️  Updated:  ${updatedCount} specialities`);
    console.log(`❌ Errors:   ${errorCount} specialities`);
    console.log(`📊 Total:    ${createdCount + updatedCount} specialities processed`);
    console.log('');
    
    // Verify final count
    const finalCount = await Speciality.countDocuments();
    const activeCount = await Speciality.countDocuments({ isActive: true });
    
    console.log(`📈 Database Stats:`);
    console.log(`   Total Specialities: ${finalCount}`);
    console.log(`   Active: ${activeCount}`);
    console.log(`   Inactive: ${finalCount - activeCount}`);
    console.log('');
    
    // Display some sample specialities
    const samples = await Speciality.find().limit(5).lean();
    console.log('📋 Sample Specialities:');
    samples.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name} - ${s.description}`);
    });
    console.log('');
    
    console.log('✨ Specialities are now available in the database!');
    console.log('');
    
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('');
    console.error('❌ Fatal Error during seeding:');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('');
    
    if (connection) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

// Run the seed function
console.log('');
console.log('🚀 Starting Specialities Seed Script...');
console.log('');

seedSpecialities();
