// One-time repair for per-season membership entries that were created as a
// side effect of the admin edit form. Before the "Active" checkbox defaulted
// to checked for users with no entry, saving any edit (typically marking dues
// paid) persisted the form default and wrote seasons.<key>.active = false —
// an explicit opt-out — for people who had just paid. Now that standings and
// awards exclude explicit opt-outs (seasonMembersQuery in server.js), those
// entries would hide paid members.
//
// Repairs entries where active is false AND duesPaid is true (paid dues is
// taken as proof of membership) by setting active to true. Entries with
// active: false and duesPaid: false are left alone — those may be genuine
// opt-outs and must be reviewed by an admin.
//
// Usage: node backend/fix_membership_artifacts.js --season 2026 [--dry-run]
// Safe to re-run: it only ever flips active false -> true on paid entries.
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI is not set.');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const seasonIdx = args.indexOf('--season');
const seasonKey = seasonIdx !== -1 ? args[seasonIdx + 1] : null;
if (!seasonKey || !/^\d{4}(_[a-z0-9]+)?$/.test(seasonKey)) {
  console.error('Usage: node backend/fix_membership_artifacts.js --season <2026|2026_preseason> [--dry-run]');
  process.exit(1);
}

const MAIN_DB = 'locks_data';
const activeField = `seasons.${seasonKey}.active`;
const duesField = `seasons.${seasonKey}.duesPaid`;

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const users = client.db(MAIN_DB).collection('users');
    if (dryRun) console.log('DRY RUN — no writes will be performed.\n');
    console.log(`Season ${seasonKey}`);

    const paidButInactive = await users.find({ [activeField]: false, [duesField]: true })
      .project({ email: 1, [`seasons.${seasonKey}`]: 1 }).toArray();
    const unpaidInactive = await users.find({ [activeField]: false, [duesField]: { $ne: true } })
      .project({ email: 1 }).toArray();
    const noEntry = await users.countDocuments({ [activeField]: { $exists: false } });

    console.log(`  active:false + duesPaid:true (will flip to active:true): ${paidButInactive.length}`);
    for (const u of paidButInactive) {
      const e = u.seasons[seasonKey];
      console.log(`    ${u.email}  duesPaid on ${e.dateDuesPaid || '(no date)'}`);
    }
    console.log(`  active:false + duesPaid:false (left alone — review as possible opt-outs): ${unpaidInactive.length}`);
    for (const u of unpaidInactive) console.log(`    ${u.email}`);
    console.log(`  no entry for ${seasonKey} (untouched; counted as members until explicitly set Inactive): ${noEntry}`);

    if (!dryRun && paidButInactive.length > 0) {
      const result = await users.updateMany(
        { [activeField]: false, [duesField]: true },
        { $set: { [activeField]: true, updatedAt: new Date() } }
      );
      console.log(`\nUpdated ${result.modifiedCount} user(s).`);
    } else if (dryRun) {
      console.log('\nDRY RUN — no writes were performed.');
    } else {
      console.log('\nNothing to update.');
    }
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
