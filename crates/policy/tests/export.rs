use specta::{ts, TypeMap};
use std::path::PathBuf;

#[test]
pub fn export() {
    // TODO: A helper similar to this should probs be added to the `specta` crate.
    fn export_with_children<T: specta::NamedType>() -> String {
        let mut map = TypeMap::default();
        let mut result = ts::export_named_datatype(
            &Default::default(),
            &T::definition_named_data_type(&mut map),
            &map,
        )
        .unwrap();

        for (_, ty) in map.clone().iter() {
            result.push_str("\n\n");
            result
                .push_str(&ts::export_named_datatype(&Default::default(), &ty, &mut map).unwrap());
        }

        result
    }

    let result = [
            "//! This file is generated by the 'export' unit test in 'mattrax-policy'! Do not modify it manually!"
                .to_string(),
            export_with_children::<mattrax_policy::Policy>(),
        ];

    std::fs::write(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../apps/web/src/lib/policy.ts"),
        result.join("\n\n"),
    )
    .unwrap();
}
