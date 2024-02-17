use yaserde::{YaDeserialize, YaSerialize};

use crate::SyncHdr;

/// The MsgRef element type specifies a reference to a MsgID (section 2.2.3.6) that is used by a SyncML Results (section 2.2.7.8) or response Status (section 2.2.6.1).
#[derive(Debug, Clone, PartialEq, Eq, Hash, YaSerialize, YaDeserialize)]
pub struct MsgRef {
    // TODO: Tuple structs are broken
    #[yaserde(child)]
    child: String,
}

impl MsgRef {
    pub fn from(header: &SyncHdr) -> Self {
        Self {
            child: header.msg_id.clone(),
        }
    }
}