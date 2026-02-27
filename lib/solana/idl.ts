/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/liars_bar_dapp.json`.
 */
export type LiarsBarDapp = {
  "address": "F618XAoLrCWU7vx5ccd9HB1x85ttjqWwb77FG4TSVWE6",
  "metadata": {
    "name": "liarsBarDapp",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createTable",
      "discriminator": [
        214,
        142,
        131,
        250,
        242,
        83,
        135,
        185
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [
        {
          "name": "tableId",
          "type": "u128"
        }
      ]
    },
    {
      "name": "grantCardAccess",
      "discriminator": [
        139,
        60,
        161,
        217,
        27,
        25,
        197,
        92
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "player",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tableId",
          "type": "u128"
        }
      ]
    },
    {
      "name": "joinTable",
      "discriminator": [
        14,
        117,
        84,
        51,
        95,
        146,
        171,
        70
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [
        {
          "name": "tableId",
          "type": "u128"
        },
        {
          "name": "characterId",
          "type": "string"
        }
      ]
    },
    {
      "name": "liarsCall",
      "discriminator": [
        102,
        159,
        213,
        9,
        226,
        61,
        66,
        85
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [
        {
          "name": "tableId",
          "type": "u128"
        }
      ]
    },
    {
      "name": "placeCards",
      "discriminator": [
        252,
        174,
        93,
        119,
        26,
        166,
        62,
        46
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [
        {
          "name": "tableId",
          "type": "u128"
        },
        {
          "name": "pickedIndexs",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "quitTable",
      "discriminator": [
        72,
        118,
        106,
        80,
        28,
        10,
        132,
        188
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [
        {
          "name": "tableId",
          "type": "u128"
        }
      ]
    },
    {
      "name": "startRound",
      "discriminator": [
        144,
        144,
        43,
        7,
        193,
        42,
        217,
        215
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [
        {
          "name": "tableId",
          "type": "u128"
        }
      ]
    },
    {
      "name": "suffleCards",
      "discriminator": [
        159,
        169,
        24,
        144,
        154,
        241,
        233,
        162
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tableId",
          "type": "u128"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "liarsTable",
      "discriminator": [
        115,
        186,
        40,
        203,
        75,
        228,
        102,
        166
      ]
    },
    {
      "name": "player",
      "discriminator": [
        205,
        222,
        112,
        7,
        165,
        155,
        206,
        218
      ]
    }
  ],
  "events": [
    {
      "name": "cardPlaced",
      "discriminator": [
        246,
        134,
        49,
        112,
        59,
        114,
        154,
        29
      ]
    },
    {
      "name": "emptyBulletFired",
      "discriminator": [
        110,
        29,
        145,
        237,
        75,
        13,
        174,
        243
      ]
    },
    {
      "name": "gameOver",
      "discriminator": [
        122,
        28,
        20,
        209,
        123,
        166,
        111,
        64
      ]
    },
    {
      "name": "gameWinner",
      "discriminator": [
        140,
        179,
        49,
        235,
        98,
        122,
        213,
        148
      ]
    },
    {
      "name": "liarCalled",
      "discriminator": [
        55,
        202,
        78,
        94,
        104,
        9,
        34,
        165
      ]
    },
    {
      "name": "liarsTableCreated",
      "discriminator": [
        15,
        186,
        232,
        22,
        95,
        188,
        13,
        127
      ]
    },
    {
      "name": "playerEleminated",
      "discriminator": [
        70,
        10,
        205,
        125,
        189,
        194,
        189,
        217
      ]
    },
    {
      "name": "playerJoined",
      "discriminator": [
        39,
        144,
        49,
        106,
        108,
        210,
        183,
        38
      ]
    },
    {
      "name": "roundStarted",
      "discriminator": [
        180,
        209,
        2,
        244,
        238,
        48,
        170,
        120
      ]
    },
    {
      "name": "suffleCardsForPlayer",
      "discriminator": [
        127,
        195,
        85,
        107,
        182,
        62,
        225,
        216
      ]
    },
    {
      "name": "tableTrun",
      "discriminator": [
        87,
        20,
        99,
        18,
        166,
        189,
        49,
        165
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "tableAlreadyInitialized",
      "msg": "Table Already Initialized"
    },
    {
      "code": 6001,
      "name": "tableIsFull",
      "msg": "Table is full please join other table"
    },
    {
      "code": 6002,
      "name": "notYourTrunSuffle",
      "msg": "Not your trun to call suffle you scripter"
    },
    {
      "code": 6003,
      "name": "notYourTrun",
      "msg": "Not Your Trun to play you scripter"
    },
    {
      "code": 6004,
      "name": "notEligible",
      "msg": "You are Not Eligible for this call"
    },
    {
      "code": 6005,
      "name": "needTwoPlayer",
      "msg": "Need At Least Two Player"
    },
    {
      "code": 6006,
      "name": "shuffleNotComplete",
      "msg": "All players must shuffle before playing"
    }
  ],
  "types": [
    {
      "name": "card",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "shape",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          },
          {
            "name": "value",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          }
        ]
      }
    },
    {
      "name": "cardPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "player",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "deckRow",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "values",
            "type": {
              "vec": {
                "defined": {
                  "name": "ebool"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "ebool",
      "type": {
        "kind": "struct",
        "fields": [
          "u128"
        ]
      }
    },
    {
      "name": "emptyBulletFired",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "player",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "euint128",
      "type": {
        "kind": "struct",
        "fields": [
          "u128"
        ]
      }
    },
    {
      "name": "liarCalled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "caller",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "liarsTable",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "tableCard",
            "type": "u8"
          },
          {
            "name": "cardsOnTable",
            "type": {
              "vec": {
                "defined": {
                  "name": "card"
                }
              }
            }
          },
          {
            "name": "remainingBullet",
            "type": "bytes"
          },
          {
            "name": "isOpen",
            "type": "bool"
          },
          {
            "name": "isOver",
            "type": "bool"
          },
          {
            "name": "players",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "deck",
            "type": {
              "vec": {
                "defined": {
                  "name": "deckRow"
                }
              }
            }
          },
          {
            "name": "trunToPlay",
            "type": "u8"
          },
          {
            "name": "suffleTrun",
            "type": "u8"
          },
          {
            "name": "playerCardsLeft",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "liarsTableCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "player",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "characterId",
            "type": "string"
          },
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "cards",
            "type": {
              "vec": {
                "defined": {
                  "name": "card"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "playerEleminated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "player",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "playerJoined",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "player",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "roundStarted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "suffleCardsForPlayer",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "next",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tableTrun",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "player",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "gameOver",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "gameWinner",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "type": "u128"
          },
          {
            "name": "player",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};

export const IDL: LiarsBarDapp = {
  "address": "F618XAoLrCWU7vx5ccd9HB1x85ttjqWwb77FG4TSVWE6",
  "metadata": {
    "name": "liarsBarDapp",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createTable",
      "discriminator": [214, 142, 131, 250, 242, 83, 135, 185],
      "accounts": [
        { "name": "signer", "writable": true, "signer": true },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 97, 98, 108, 101] },
              { "kind": "arg", "path": "tableId" }
            ]
          }
        },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [{ "name": "tableId", "type": "u128" }]
    },
    {
      "name": "grantCardAccess",
      "discriminator": [139, 60, 161, 217, 27, 25, 197, 92],
      "accounts": [
        { "name": "signer", "writable": true, "signer": true },
        {
          "name": "player",
          "pda": {
            "seeds": [
              { "kind": "const", "value": [112, 108, 97, 121, 101, 114] },
              { "kind": "arg", "path": "tableId" },
              { "kind": "account", "path": "signer" }
            ]
          }
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [{ "name": "tableId", "type": "u128" }]
    },
    {
      "name": "joinTable",
      "discriminator": [14, 117, 84, 51, 95, 146, 171, 70],
      "accounts": [
        { "name": "signer", "writable": true, "signer": true },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 97, 98, 108, 101] },
              { "kind": "arg", "path": "tableId" }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [112, 108, 97, 121, 101, 114] },
              { "kind": "arg", "path": "tableId" },
              { "kind": "account", "path": "signer" }
            ]
          }
        },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [
        { "name": "tableId", "type": "u128" },
        { "name": "characterId", "type": "string" }
      ]
    },
    {
      "name": "liarsCall",
      "discriminator": [102, 159, 213, 9, 226, 61, 66, 85],
      "accounts": [
        { "name": "signer", "writable": true, "signer": true },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 97, 98, 108, 101] },
              { "kind": "arg", "path": "tableId" }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [112, 108, 97, 121, 101, 114] },
              { "kind": "arg", "path": "tableId" },
              { "kind": "account", "path": "signer" }
            ]
          }
        },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [{ "name": "tableId", "type": "u128" }]
    },
    {
      "name": "placeCards",
      "discriminator": [252, 174, 93, 119, 26, 166, 62, 46],
      "accounts": [
        { "name": "user", "writable": true, "signer": true },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 97, 98, 108, 101] },
              { "kind": "arg", "path": "tableId" }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [112, 108, 97, 121, 101, 114] },
              { "kind": "arg", "path": "tableId" },
              { "kind": "account", "path": "user" }
            ]
          }
        },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [
        { "name": "tableId", "type": "u128" },
        { "name": "pickedIndexs", "type": "bytes" }
      ]
    },
    {
      "name": "quitTable",
      "discriminator": [72, 118, 106, 80, 28, 10, 132, 188],
      "accounts": [
        { "name": "signer", "writable": true, "signer": true },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 97, 98, 108, 101] },
              { "kind": "arg", "path": "tableId" }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [112, 108, 97, 121, 101, 114] },
              { "kind": "arg", "path": "tableId" },
              { "kind": "account", "path": "signer" }
            ]
          }
        },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [{ "name": "tableId", "type": "u128" }]
    },
    {
      "name": "startRound",
      "discriminator": [144, 144, 43, 7, 193, 42, 217, 215],
      "accounts": [
        { "name": "signer", "writable": true, "signer": true },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 97, 98, 108, 101] },
              { "kind": "arg", "path": "tableId" }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [112, 108, 97, 121, 101, 114] },
              { "kind": "arg", "path": "tableId" },
              { "kind": "account", "path": "signer" }
            ]
          }
        },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [{ "name": "tableId", "type": "u128" }]
    },
    {
      "name": "suffleCards",
      "discriminator": [159, 169, 24, 144, 154, 241, 233, 162],
      "accounts": [
        { "name": "signer", "writable": true, "signer": true },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 97, 98, 108, 101] },
              { "kind": "arg", "path": "tableId" }
            ]
          }
        },
        {
          "name": "players",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [112, 108, 97, 121, 101, 114] },
              { "kind": "arg", "path": "tableId" },
              { "kind": "account", "path": "signer" }
            ]
          }
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [{ "name": "tableId", "type": "u128" }]
    }
  ],
  "accounts": [
    { "name": "liarsTable", "discriminator": [115, 186, 40, 203, 75, 228, 102, 166] },
    { "name": "player", "discriminator": [205, 222, 112, 7, 165, 155, 206, 218] }
  ],
  "events": [
    { "name": "cardPlaced", "discriminator": [246, 134, 49, 112, 59, 114, 154, 29] },
    { "name": "emptyBulletFired", "discriminator": [110, 29, 145, 237, 75, 13, 174, 243] },
    { "name": "gameOver", "discriminator": [122, 28, 20, 209, 123, 166, 111, 64] },
    { "name": "gameWinner", "discriminator": [140, 179, 49, 235, 98, 122, 213, 148] },
    { "name": "liarCalled", "discriminator": [55, 202, 78, 94, 104, 9, 34, 165] },
    { "name": "liarsTableCreated", "discriminator": [15, 186, 232, 22, 95, 188, 13, 127] },
    { "name": "playerEleminated", "discriminator": [70, 10, 205, 125, 189, 194, 189, 217] },
    { "name": "playerJoined", "discriminator": [39, 144, 49, 106, 108, 210, 183, 38] },
    { "name": "roundStarted", "discriminator": [180, 209, 2, 244, 238, 48, 170, 120] },
    { "name": "suffleCardsForPlayer", "discriminator": [127, 195, 85, 107, 182, 62, 225, 216] },
    { "name": "tableTrun", "discriminator": [87, 20, 99, 18, 166, 189, 49, 165] }
  ],
  "errors": [
    { "code": 6000, "name": "tableAlreadyInitialized", "msg": "Table Already Initialized" },
    { "code": 6001, "name": "tableIsFull", "msg": "Table is full please join other table" },
    { "code": 6002, "name": "notYourTrunSuffle", "msg": "Not your trun to call suffle you scripter" },
    { "code": 6003, "name": "notYourTrun", "msg": "Not Your Trun to play you scripter" },
    { "code": 6004, "name": "notEligible", "msg": "You are Not Eligible for this call" },
    { "code": 6005, "name": "needTwoPlayer", "msg": "Need At Least Two Player" },
    { "code": 6006, "name": "shuffleNotComplete", "msg": "All players must shuffle before playing" }
  ],
  "types": [
    {
      "name": "card",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "shape", "type": { "defined": { "name": "euint128" } } },
          { "name": "value", "type": { "defined": { "name": "euint128" } } }
        ]
      }
    },
    {
      "name": "cardPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" },
          { "name": "player", "type": "pubkey" }
        ]
      }
    },
    {
      "name": "deckRow",
      "type": { "kind": "struct", "fields": [{ "name": "values", "type": { "vec": { "defined": { "name": "ebool" } } } }] }
    },
    {
      "name": "ebool",
      "type": { "kind": "struct", "fields": ["u128"] }
    },
    {
      "name": "emptyBulletFired",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" },
          { "name": "player", "type": "pubkey" }
        ]
      }
    },
    {
      "name": "euint128",
      "type": { "kind": "struct", "fields": ["u128"] }
    },
    {
      "name": "liarCalled",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" },
          { "name": "caller", "type": "pubkey" }
        ]
      }
    },
    {
      "name": "liarsTable",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" },
          { "name": "tableCard", "type": "u8" },
          { "name": "cardsOnTable", "type": { "vec": { "defined": { "name": "card" } } } },
          { "name": "remainingBullet", "type": "bytes" },
          { "name": "isOpen", "type": "bool" },
          { "name": "isOver", "type": "bool" },
          { "name": "players", "type": { "vec": "pubkey" } },
          { "name": "deck", "type": { "vec": { "defined": { "name": "deckRow" } } } },
          { "name": "trunToPlay", "type": "u8" },
          { "name": "suffleTrun", "type": "u8" },
          { "name": "playerCardsLeft", "type": "bytes" }
        ]
      }
    },
    {
      "name": "liarsTableCreated",
      "type": {
        "kind": "struct",
        "fields": [{ "name": "tableId", "type": "u128" }]
      }
    },
    {
      "name": "player",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "characterId", "type": "string" },
          { "name": "tableId", "type": "u128" },
          { "name": "cards", "type": { "vec": { "defined": { "name": "card" } } } }
        ]
      }
    },
    {
      "name": "playerEleminated",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" },
          { "name": "player", "type": "pubkey" }
        ]
      }
    },
    {
      "name": "playerJoined",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" },
          { "name": "player", "type": "pubkey" }
        ]
      }
    },
    {
      "name": "roundStarted",
      "type": {
        "kind": "struct",
        "fields": [{ "name": "tableId", "type": "u128" }]
      }
    },
    {
      "name": "suffleCardsForPlayer",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" },
          { "name": "player", "type": "pubkey" },
          { "name": "next", "type": "pubkey" }
        ]
      }
    },
    {
      "name": "tableTrun",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" },
          { "name": "player", "type": "pubkey" }
        ]
      }
    },
    {
      "name": "gameOver",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" }
        ]
      }
    },
    {
      "name": "gameWinner",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tableId", "type": "u128" },
          { "name": "player", "type": "pubkey" }
        ]
      }
    }
  ]
};
